import { Event } from 'vs/base/common/event'
import { IDisposable } from 'vs/base/common/lifecycle'
import { IStorage, IStorageDatabase, IStorageItemsChangeEvent, IUpdateRequest, Storage } from 'vs/base/parts/storage/common/storage'
import { IEditorOverrideServices } from 'vs/editor/standalone/browser/standaloneServices'
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors'
import { AbstractStorageService, IStorageService, StorageScope as VSStorageScope } from 'vs/platform/storage/common/storage'
import { IUserDataProfile } from 'vs/platform/userDataProfile/common/userDataProfile'
import { IAnyWorkspaceIdentifier } from 'vs/platform/workspace/common/workspace'
import { BrowserStorageService } from 'vs/workbench/services/storage/browser/storageService'
import { ILogService } from 'vs/platform/log/common/log'
import { IUserDataProfileService } from 'vs/workbench/services/userDataProfile/common/userDataProfile'
import { IHostService } from 'vs/workbench/services/host/browser/host'
import { ExtensionStorageService, IExtensionStorageService } from 'vs/platform/extensionManagement/common/extensionStorage'
import { registerServiceInitializePreParticipant } from '../lifecycle'
import { getWorkspaceIdentifier } from '../workbench'

export enum StorageScope {
  APPLICATION = VSStorageScope.APPLICATION,
  PROFILE = VSStorageScope.PROFILE,
  WORKSPACE = VSStorageScope.WORKSPACE
}

export interface IStorageProvider {
  read (scope: StorageScope): Map<string, string> | undefined
  write (scope: StorageScope, data: Map<string, string>): Promise<void>
  close? (scope: StorageScope): Promise<void>
  onDidChange? (listener: (event: IStorageItemsChangeEvent) => void): IDisposable
  optimize? (scope: StorageScope): Promise<void>
}

class ExternalStorage extends Storage {
  constructor (
    scope: StorageScope,
    provider: IStorageProvider
  ) {
    const items = provider.read(scope)

    super(new ExternalStorageDatabase(scope, provider, items))

    if (items != null) {
      for (const [key, value] of items) {
        this.items.set(key, value)
      }
    }
  }
}

class ExternalStorageDatabase implements IStorageDatabase {
  readonly onDidChangeItemsExternal: Event<IStorageItemsChangeEvent>

  constructor (
    private readonly scope: StorageScope,
    private readonly provider: IStorageProvider,
    private readonly items = new Map<string, string>()
  ) {
    this.onDidChangeItemsExternal = this.provider.onDidChange ?? Event.None
  }

  async getItems (): Promise<Map<string, string>> {
    return this.items
  }

  async updateItems (request: IUpdateRequest): Promise<void> {
    request.insert?.forEach((value, key) => this.items.set(key, value))

    request.delete?.forEach(key => this.items.delete(key))

    await this.provider.write(this.scope, this.items)
  }

  async close () {
    return this.provider.close?.(this.scope)
  }

  async optimize (): Promise<void> {
    return this.provider.optimize?.(this.scope)
  }
}

class ExternalStorageService extends AbstractStorageService {
  private readonly applicationStorage = this._register(new ExternalStorage(StorageScope.APPLICATION, this.provider))
  private readonly profileStorage = this._register(new ExternalStorage(StorageScope.PROFILE, this.provider))
  private readonly workspaceStorage = this._register(new ExternalStorage(StorageScope.WORKSPACE, this.provider))

  constructor (protected readonly provider: IStorageProvider) {
    super({
      flushInterval: 5000
    })

    this._register(this.workspaceStorage.onDidChangeStorage(key => this.emitDidChangeValue(VSStorageScope.WORKSPACE, key)))
    this._register(this.profileStorage.onDidChangeStorage(key => this.emitDidChangeValue(VSStorageScope.PROFILE, key)))
    this._register(this.applicationStorage.onDidChangeStorage(key => this.emitDidChangeValue(VSStorageScope.APPLICATION, key)))
  }

  protected getStorage (scope: VSStorageScope): IStorage {
    switch (scope) {
      case VSStorageScope.APPLICATION:
        return this.applicationStorage
      case VSStorageScope.PROFILE:
        return this.profileStorage
      default:
        return this.workspaceStorage
    }
  }

  protected getLogDetails (scope: VSStorageScope): string | undefined {
    switch (scope) {
      case VSStorageScope.APPLICATION:
        return 'External (application)'
      case VSStorageScope.PROFILE:
        return 'External (profile)'
      default:
        return 'External (workspace)'
    }
  }

  protected async doInitialize (): Promise<void> {
    // no-op
  }

  protected async switchToProfile (): Promise<void> {
    // no-op
  }

  protected async switchToWorkspace (): Promise<void> {
    // no-op
  }

  hasScope (_scope: IAnyWorkspaceIdentifier | IUserDataProfile): boolean {
    return false
  }
}

registerServiceInitializePreParticipant(async (accessor) => {
  const storageService = accessor.get(IStorageService)
  const hostService = accessor.get(IHostService)
  if (storageService instanceof AbstractStorageService) {
    await storageService.initialize()

    hostService.onDidChangeFocus(focus => {
      if (!focus) {
        void storageService.flush()
      }
    })
  }
})

class InjectedBrowserStorageService extends BrowserStorageService {
  constructor (
    @IUserDataProfileService userDataProfileService: IUserDataProfileService,
    @ILogService logService: ILogService
  ) {
    super(getWorkspaceIdentifier(), userDataProfileService, logService)
  }
}

export default function getStorageServiceOverride (provider?: IStorageProvider): IEditorOverrideServices {
  if (provider != null) {
    return {
      [IStorageService.toString()]: new SyncDescriptor(ExternalStorageService, [provider], true),
      [IExtensionStorageService.toString()]: new SyncDescriptor(ExtensionStorageService, [], true)
    }
  } else {
    return {
      [IStorageService.toString()]: new SyncDescriptor(InjectedBrowserStorageService, [], true),
      [IExtensionStorageService.toString()]: new SyncDescriptor(ExtensionStorageService, [], true)
    }
  }
}

export {
  IStorageItemsChangeEvent,
  ExternalStorageService,
  InjectedBrowserStorageService as BrowserStorageService
}
