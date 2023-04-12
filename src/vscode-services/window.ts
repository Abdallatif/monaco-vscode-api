import Severity from 'vs/base/common/severity'
import { URI } from 'vs/base/common/uri'
import type * as vscode from 'vscode'
import { Event } from 'vs/base/common/event'
import * as extHostTypes from 'vs/workbench/api/common/extHostTypes'
import { StandaloneServices } from 'vs/editor/standalone/browser/standaloneServices'
import { IModelService } from 'vs/editor/common/services/model'
import { DisposableStore } from 'vs/base/common/lifecycle'
import { ITextModel } from 'vs/editor/common/model'
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions'
import { getExtHostServices } from './extHost'
import { unsupported } from '../tools'

class TextTabInput {
  constructor (readonly uri: URI) { }
}

function getTabFromModel (model: ITextModel, tabGroup: vscode.TabGroup): vscode.Tab {
  return {
    label: model.uri.fsPath,
    group: tabGroup,
    get isActive () { return model.isAttachedToEditor() },
    isDirty: false,
    isPinned: false,
    isPreview: false,
    input: new TextTabInput(model.uri)
  }
}

const tabGroup: vscode.TabGroup = {
  isActive: true,
  activeTab: undefined,
  viewColumn: extHostTypes.ViewColumn.One,
  get tabs () {
    const modelService = StandaloneServices.get(IModelService)
    return modelService.getModels().map(model => getTabFromModel(model, tabGroup))
  }
}

export default function create (getExtension: () => IExtensionDescription, workspace: typeof vscode.workspace): typeof vscode.window {
  return {
    showInformationMessage (message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
      const { extHostMessageService } = getExtHostServices()
      return extHostMessageService.showMessage(getExtension(), Severity.Info, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1))
    },
    showWarningMessage (message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
      const { extHostMessageService } = getExtHostServices()
      return extHostMessageService.showMessage(getExtension(), Severity.Warning, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1))
    },
    showErrorMessage (message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
      const { extHostMessageService } = getExtHostServices()
      return extHostMessageService.showMessage(getExtension(), Severity.Error, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1))
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createOutputChannel (name: string, options: string | { log: true } | undefined): any {
      const { extHostOutputService } = getExtHostServices()
      return extHostOutputService.createOutputChannel(name, options, getExtension())
    },
    withScmProgress<R> (task: (progress: vscode.Progress<number>) => Thenable<R>) {
      const { extHostProgress } = getExtHostServices()
      return extHostProgress.withProgress(getExtension(), { location: extHostTypes.ProgressLocation.SourceControl }, () => task({ report () { } }))
    },
    withProgress<R> (options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string, worked?: number} >, token: vscode.CancellationToken) => Thenable<R>) {
      const { extHostProgress } = getExtHostServices()
      return extHostProgress.withProgress(getExtension(), options, task)
    },
    showTextDocument: async (documentOrUri: vscode.TextDocument | vscode.Uri, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions, preserveFocus?: boolean) => {
      const { extHostEditors } = getExtHostServices()
      const document = await (URI.isUri(documentOrUri)
        ? Promise.resolve(workspace.openTextDocument(documentOrUri))
        : Promise.resolve(<vscode.TextDocument>documentOrUri))

      return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus)
    },
    createQuickPick<T extends vscode.QuickPickItem> (): vscode.QuickPick<T> {
      const { extHostQuickOpen } = getExtHostServices()
      return extHostQuickOpen.createQuickPick(getExtension())
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    showQuickPick (items: any, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): any {
      const { extHostQuickOpen } = getExtHostServices()
      const extension = getExtension()
      return extHostQuickOpen.showQuickPick(extension, items, options, token)
    },
    createInputBox (): vscode.InputBox {
      const { extHostQuickOpen } = getExtHostServices()
      const extension = getExtension()
      return extHostQuickOpen.createInputBox(extension)
    },
    showInputBox (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken) {
      const { extHostQuickOpen } = getExtHostServices()
      return extHostQuickOpen.showInput(options, token)
    },
    createTextEditorDecorationType: unsupported,
    showWorkspaceFolderPick: unsupported,
    showOpenDialog: unsupported,
    showSaveDialog: unsupported,
    createWebviewPanel: unsupported,
    setStatusBarMessage: unsupported,
    createStatusBarItem: unsupported,
    createTerminal: unsupported,
    registerTreeDataProvider: unsupported,
    createTreeView: unsupported,
    registerWebviewPanelSerializer: unsupported,
    get activeTextEditor () {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.getActiveTextEditor()
    },
    get visibleTextEditors () {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.getVisibleTextEditors()
    },
    onDidChangeActiveTextEditor (listener, thisArg?, disposables?) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeActiveTextEditor(listener, thisArg, disposables)
    },
    onDidChangeVisibleTextEditors (listener, thisArg, disposables) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeVisibleTextEditors(listener, thisArg, disposables)
    },
    onDidChangeTextEditorSelection (listener, thisArgs, disposables) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeTextEditorSelection(listener, thisArgs, disposables)
    },
    onDidChangeTextEditorVisibleRanges (listener, thisArgs, disposables) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeTextEditorVisibleRanges(listener, thisArgs, disposables)
    },
    onDidChangeTextEditorOptions (listener, thisArgs, disposables) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeTextEditorOptions(listener, thisArgs, disposables)
    },
    onDidChangeTextEditorViewColumn (listener, thisArg?, disposables?) {
      const { extHostEditors } = getExtHostServices()
      return extHostEditors.onDidChangeTextEditorViewColumn(listener, thisArg, disposables)
    },
    get terminals () {
      return unsupported()
    },
    get activeTerminal () {
      return unsupported()
    },
    onDidChangeActiveTerminal: Event.None,
    onDidOpenTerminal: Event.None,
    onDidCloseTerminal: Event.None,
    get state () {
      return unsupported()
    },
    onDidChangeWindowState: Event.None,
    registerUriHandler: unsupported,
    registerWebviewViewProvider: unsupported,
    registerCustomEditorProvider: unsupported,
    registerTerminalLinkProvider: unsupported,
    get activeColorTheme () {
      return unsupported()
    },
    onDidChangeActiveColorTheme: Event.None,
    registerFileDecorationProvider: unsupported,
    registerTerminalProfileProvider: unsupported,
    onDidChangeTerminalState: Event.None,
    tabGroups: {
      get all () {
        return [tabGroup]
      },
      activeTabGroup: tabGroup,
      onDidChangeTabGroups: Event.None,
      onDidChangeTabs (listener) {
        const modelService = StandaloneServices.get(IModelService)
        const store = new DisposableStore()
        store.add(modelService.onModelAdded((model) => {
          listener({
            opened: [getTabFromModel(model, tabGroup)],
            closed: [],
            changed: []
          })
        }))
        store.add(modelService.onModelRemoved((model) => {
          listener({
            opened: [],
            closed: [getTabFromModel(model, tabGroup)],
            changed: []
          })
        }))

        return store
      },
      close: unsupported
    },
    showNotebookDocument: unsupported,
    visibleNotebookEditors: [],
    onDidChangeVisibleNotebookEditors: Event.None,
    activeNotebookEditor: undefined,
    onDidChangeActiveNotebookEditor: Event.None,
    onDidChangeNotebookEditorSelection: Event.None,
    onDidChangeNotebookEditorVisibleRanges: Event.None
  }
}

export {
  TextTabInput
}
