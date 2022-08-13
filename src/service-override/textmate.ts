import '../polyfill'
import '../vscode-services/missing-services'
import { StandaloneServices, IEditorOverrideServices } from 'vs/editor/standalone/browser/standaloneServices'
import { ITextMateService } from 'vs/workbench/services/textMate/browser/textMate'
import { ExtensionMessageCollector, ExtensionPoint, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry'
import { ITMSyntaxExtensionPoint } from 'vs/workbench/services/textMate/common/TMGrammars'
import { joinPath } from 'vs/base/common/resources'
import { AbstractTextMateService } from 'vs/workbench/services/textMate/browser/abstractTextMateService'
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation'
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors'
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions'
import getFileServiceOverride, { registerExtensionFile } from './files'
import { consoleExtensionMessageHandler } from './tools'
import { Services } from '../services'
import { DEFAULT_EXTENSION } from '../vscode-services/extHost'
import { createInjectedClass } from '../tools/injection'

class TextMateService extends createInjectedClass(AbstractTextMateService) {
  constructor (
    private loadVSCodeOnigurumWASM: () => Promise<Response | ArrayBuffer>,
    @IInstantiationService instantiationService: IInstantiationService
  ) {
    super(instantiationService)
  }

  protected _loadVSCodeOnigurumWASM (): Promise<Response | ArrayBuffer> {
    return this.loadVSCodeOnigurumWASM()
  }
}

const extensionPoint: ExtensionPoint<ITMSyntaxExtensionPoint[]> = ExtensionsRegistry.getExtensionPoints().find(ep => ep.name === 'grammars')!

export function setGrammars<T extends ITMSyntaxExtensionPoint> (grammars: T[], getContent: (grammar: T) => Promise<string>, extension: IExtensionDescription = Services.get().extension ?? DEFAULT_EXTENSION): void {
  extensionPoint.acceptUsers([{
    description: extension,
    value: grammars,
    collector: new ExtensionMessageCollector(consoleExtensionMessageHandler, extension, extensionPoint.name)
  }])

  for (const grammar of grammars) {
    registerExtensionFile(joinPath(extension.extensionLocation, grammar.path), () => getContent(grammar))
  }
}

function initialize () {
  // LanguageConfigurationFileHandler
  // Force load the service
  StandaloneServices.get(ITextMateService)
}

export default function getServiceOverride (getOnigLib: () => Promise<Response | ArrayBuffer>): IEditorOverrideServices {
  setTimeout(initialize)
  return {
    ...getFileServiceOverride(),
    [ITextMateService.toString()]: new SyncDescriptor(TextMateService, [getOnigLib])
  }
}

export {
  ITextMateService,
  ITMSyntaxExtensionPoint
}
