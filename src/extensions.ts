import './polyfill'
import type * as vscode from 'vscode'
import { ExtensionIdentifier, ExtensionType, IExtension, IExtensionContributions, IExtensionDescription, IExtensionManifest, TargetPlatform } from 'vs/platform/extensions/common/extensions'
import { ExtensionMessageCollector, ExtensionPoint, ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry'
import { IMessage, toExtensionDescription } from 'vs/workbench/services/extensions/common/extensions'
import { generateUuid } from 'vs/base/common/uuid'
import { URI } from 'vs/base/common/uri'
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService'
import { StandaloneServices } from 'vs/editor/standalone/browser/standaloneServices'
import { getExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil'
import { IDisposable } from 'vs/base/common/lifecycle'
import Severity from 'vs/base/common/severity'
import * as api from './api'
import { registerExtensionFile } from './service-override/files'
import createLanguagesApi from './vscode-services/languages'
import createCommandsApi from './vscode-services/commands'
import createWorkspaceApi from './vscode-services/workspace'
import createWindowApi from './vscode-services/window'
import createEnvApi from './vscode-services/env'
import createDebugApi from './vscode-services/debug'
import createExtensionsApi from './vscode-services/extensions'
import { initialize as initializeExtHostServices, onExtHostInitialized } from './vscode-services/extHost'

export function consoleExtensionMessageHandler (msg: IMessage): void {
  if (msg.type === Severity.Error) {
    console.error(msg)
  } else if (msg.type === Severity.Warning) {
    console.warn(msg)
  } else {
    // eslint-disable-next-line no-console
    console.log(msg)
  }
}

let DEFAULT_EXTENSION: IExtensionDescription = {
  identifier: new ExtensionIdentifier('monaco'),
  isBuiltin: true,
  isUserBuiltin: true,
  isUnderDevelopment: false,
  extensionLocation: URI.from({ scheme: 'extension', path: '/' }),
  name: 'monaco',
  publisher: 'microsoft',
  version: '1.0.0',
  engines: {
    vscode: VSCODE_VERSION
  },
  targetPlatform: TargetPlatform.WEB
}

export function getDefaultExtension (): IExtensionDescription {
  return DEFAULT_EXTENSION
}

export async function initialize (extension?: IExtensionDescription): Promise<void> {
  if (extension != null) {
    DEFAULT_EXTENSION = extension
  }

  await initializeExtHostServices()
}

export function createApi (extension: IExtensionDescription): typeof vscode {
  const workspace = createWorkspaceApi(() => extension)
  return {
    ...api,
    extensions: createExtensionsApi(() => extension),
    debug: createDebugApi(() => extension),
    env: createEnvApi(() => extension),
    commands: createCommandsApi(() => extension),
    window: createWindowApi(() => extension, workspace),
    workspace: createWorkspaceApi(() => extension),
    languages: createLanguagesApi(() => extension)
  }
}

const hasOwnProperty = Object.hasOwnProperty
function handleExtensionPoint<T extends IExtensionContributions[keyof IExtensionContributions]> (extensionPoint: ExtensionPoint<T>, availableExtensions: IExtensionDescription[], messageHandler: (msg: IMessage) => void): void {
  const users: IExtensionPointUser<T>[] = []
  for (const desc of availableExtensions) {
    if ((desc.contributes != null) && hasOwnProperty.call(desc.contributes, extensionPoint.name)) {
      users.push({
        description: desc,
        value: desc.contributes[extensionPoint.name as keyof typeof desc.contributes] as T,
        collector: new ExtensionMessageCollector(messageHandler, desc, extensionPoint.name)
      })
    }
  }
  extensionPoint.acceptUsers(users)
}

function deltaExtensions (toAdd: IExtensionDescription[], toRemove: IExtensionDescription[]) {
  void StandaloneServices.get(IExtHostExtensionService).getExtensionRegistry().then(extensionRegistry => {
    const affectedExtensions = (<IExtensionDescription[]>[]).concat(toAdd).concat(toRemove)
    const affectedExtensionPoints: { [extPointName: string]: boolean } = Object.create(null)
    for (const extensionDescription of affectedExtensions) {
      for (const extPointName in extensionDescription.contributes) {
        if (hasOwnProperty.call(extensionDescription.contributes, extPointName)) {
          affectedExtensionPoints[extPointName] = true
        }
      }
    }

    extensionRegistry.deltaExtensions(toAdd, toRemove.map(ext => ext.identifier))
    const availableExtensions = extensionRegistry.getAllExtensionDescriptions()

    const extensionPoints = ExtensionsRegistry.getExtensionPoints()
    for (const extensionPoint of extensionPoints) {
      if (affectedExtensionPoints[extensionPoint.name] ?? false) {
        handleExtensionPoint(extensionPoint, availableExtensions, consoleExtensionMessageHandler)
      }
    }
  })
}

interface RegisterExtensionResult extends IDisposable {
  api: typeof vscode
  registerFile: (path: string, getContent: () => Promise<string>) => IDisposable
  dispose (): void
}
export function registerExtension (manifest: IExtensionManifest): RegisterExtensionResult {
  const uuid = generateUuid()
  const location = URI.from({ scheme: 'extension', path: `/${uuid}` })

  const extension: IExtension = {
    manifest,
    type: ExtensionType.User,
    isBuiltin: false,
    identifier: {
      id: getExtensionId(manifest.publisher, manifest.name),
      uuid
    },
    location,
    targetPlatform: TargetPlatform.WEB,
    isValid: true,
    validations: []
  }
  const extensionDescription = toExtensionDescription(extension)

  deltaExtensions([extensionDescription], [])

  return {
    api: createApi(extensionDescription),
    registerFile: (path: string, getContent: () => Promise<string>) => {
      return registerExtensionFile(location, path, getContent)
    },
    dispose () {
      deltaExtensions([], [extensionDescription])
    }
  }
}

export {
  IExtensionManifest,
  IExtensionContributions,
  onExtHostInitialized
}
