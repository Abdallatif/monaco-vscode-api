import 'monaco-editor/esm/vs/editor/editor.all'
import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp'
import 'monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess'
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess'
import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch'
import { Services, StandaloneServices } from 'vscode/services'
import getModelEditorServiceOverride from 'vscode/service-override/modelEditor'
import getNotificationServiceOverride from 'vscode/service-override/notifications'
import getDialogsServiceOverride from 'vscode/service-override/dialogs'
import getConfigurationServiceOverride from 'vscode/service-override/configuration'
import getKeybindingsServiceOverride from 'vscode/service-override/keybindings'
import { registerExtension } from 'vscode/extensions'
import getTextmateServiceOverride from 'vscode/service-override/textmate'
import getThemeServiceOverride from 'vscode/service-override/theme'
import geTokenClassificationServiceOverride from 'vscode/service-override/tokenClassification'
import getLanguageConfigurationServiceOverride from 'vscode/service-override/languageConfiguration'
import getLanguagesServiceOverride from 'vscode/service-override/languages'
import getAudioCueServiceOverride from 'vscode/service-override/audioCue'
import getDebugServiceOverride from 'vscode/service-override/debug'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { createConfiguredEditor } from 'vscode/monaco'
import type * as vscode from 'vscode'

// Workers
interface WorkerConstructor {
  new(): Worker
}
export type WorkerLoader = () => WorkerConstructor | Promise<WorkerConstructor>
const workerLoaders: Partial<Record<string, WorkerLoader>> = {
  editorWorkerService: () => EditorWorker,
  json: () => JsonWorker
}
window.MonacoEnvironment = {
  getWorker: async function (moduleId, label) {
    const workerFactory = workerLoaders[label]
    if (workerFactory != null) {
      const Worker = await workerFactory()
      return new Worker()
    }
    throw new Error(`Unimplemented worker ${label} (${moduleId})`)
  }
}

Services.install({
  workspace: {
    workspaceFolders: [{
      index: 0,
      name: 'toto',
      uri: monaco.Uri.file('/')
    }]
  }
})

let currentEditor: ({
  model: monaco.editor.ITextModel
  editor: monaco.editor.IStandaloneCodeEditor
} & monaco.IDisposable) | null = null
function openNewCodeEditor (model: monaco.editor.ITextModel) {
  if (currentEditor != null && model === currentEditor.model) {
    return currentEditor.editor
  }
  if (currentEditor != null) {
    currentEditor.dispose()
    currentEditor = null
  }
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
  container.style.top = container.style.bottom = container.style.left = container.style.right = '0'
  container.style.cursor = 'pointer'

  const editorElem = document.createElement('div')
  editorElem.style.position = 'absolute'
  editorElem.style.top = editorElem.style.bottom = editorElem.style.left = editorElem.style.right = '0'
  editorElem.style.margin = 'auto'
  editorElem.style.width = '80%'
  editorElem.style.height = '80%'

  container.appendChild(editorElem)

  document.body.appendChild(container)
  try {
    const editor = createConfiguredEditor(
      editorElem,
      {
        model,
        readOnly: true,
        automaticLayout: true
      }
    )

    currentEditor = {
      dispose: () => {
        editor.dispose()
        document.body.removeChild(container)
        currentEditor = null
      },
      model,
      editor
    }

    container.addEventListener('mousedown', (event) => {
      if (event.target !== container) {
        return
      }

      currentEditor?.dispose()
    })

    return editor
  } catch (error) {
    document.body.removeChild(container)
    currentEditor = null
    throw error
  }
}

// Override services
StandaloneServices.initialize({
  ...getModelEditorServiceOverride(async (model) => {
    return openNewCodeEditor(model)
  }),
  ...getNotificationServiceOverride(),
  ...getDialogsServiceOverride(),
  ...getConfigurationServiceOverride(),
  ...getKeybindingsServiceOverride(),
  ...getTextmateServiceOverride(),
  ...getThemeServiceOverride(),
  ...geTokenClassificationServiceOverride(),
  ...getLanguageConfigurationServiceOverride(),
  ...getLanguagesServiceOverride(),
  ...getAudioCueServiceOverride(),
  ...getDebugServiceOverride()
})

const defaultThemesExtensions = {
  name: 'theme-defaults',
  displayName: '%displayName%',
  description: '%description%',
  categories: [
    'Themes'
  ],
  version: '1.0.0',
  publisher: 'vscode',
  license: 'MIT',
  engines: {
    vscode: '*'
  },
  contributes: {
    themes: [
      {
        id: 'Default Dark+',
        label: '%darkPlusColorThemeLabel%',
        uiTheme: 'vs-dark',
        path: './themes/dark_plus.json'
      },
      {
        id: 'Default Dark+ Experimental',
        label: '%darkPlusExperimentalColorThemeLabel%',
        uiTheme: 'vs-dark',
        path: './themes/dark_plus_experimental.json'
      },
      {
        id: 'Default Light+',
        label: '%lightPlusColorThemeLabel%',
        uiTheme: 'vs',
        path: './themes/light_plus.json'
      },
      {
        id: 'Default Light+ Experimental',
        label: '%lightPlusExperimentalColorThemeLabel%',
        uiTheme: 'vs',
        path: './themes/light_plus_experimental.json'
      },
      {
        id: 'Visual Studio Dark',
        label: '%darkColorThemeLabel%',
        uiTheme: 'vs-dark',
        path: './themes/dark_vs.json'
      },
      {
        id: 'Visual Studio Light',
        label: '%lightColorThemeLabel%',
        uiTheme: 'vs',
        path: './themes/light_vs.json'
      },
      {
        id: 'Default High Contrast',
        label: '%hcColorThemeLabel%',
        uiTheme: 'hc-black',
        path: './themes/hc_black.json'
      },
      {
        id: 'Default High Contrast Light',
        label: '%lightHcColorThemeLabel%',
        uiTheme: 'hc-light',
        path: './themes/hc_light.json'
      }
    ],
    iconThemes: [
      {
        id: 'vs-minimal',
        label: '%minimalIconThemeLabel%',
        path: './fileicons/vs_minimal-icon-theme.json'
      }
    ]
  },
  repository: {
    type: 'git',
    url: 'https://github.com/microsoft/vscode.git'
  }
}

const { registerFile: registerDefaultThemeExtensionFile } = registerExtension(defaultThemesExtensions)
registerDefaultThemeExtensionFile('/themes/dark_plus.json', async () => (await import('./resources/themes/theme-defaults~dark_plus.json?raw')).default)
registerDefaultThemeExtensionFile('/themes/light_plus.json', async () => (await import('./resources/themes/theme-defaults~light_plus.json?raw')).default)
registerDefaultThemeExtensionFile('/themes/dark_vs.json', async () => (await import('./resources/themes/theme-defaults~dark_vs.json?raw')).default)
registerDefaultThemeExtensionFile('/themes/light_vs.json', async () => (await import('./resources/themes/theme-defaults~light_vs.json?raw')).default)
registerDefaultThemeExtensionFile('/themes/hc_black.json', async () => (await import('./resources/themes/theme-defaults~hc_black.json?raw')).default)
registerDefaultThemeExtensionFile('/themes/hc_light.json', async () => (await import('./resources/themes/theme-defaults~hc_light.json?raw')).default)

const extension = {
  name: 'test',
  publisher: 'codingame',
  version: '1.0.0',
  engines: {
    vscode: '*'
  },
  contributes: {
    languages: [{
      id: 'java',
      extensions: [
        '.java',
        '.jav'
      ],
      aliases: [
        'Java',
        'java'
      ],
      configuration: './java-configuration.json'
    }, {
      id: 'json',
      aliases: [
        'JSON',
        'json'
      ],
      extensions: [
        '.json'
      ],
      mimetypes: [
        'application/json',
        'application/manifest+json'
      ],
      configuration: './json-configuration.json'
    }, {
      id: 'javascript',
      extensions: [
        '.js',
        '.es6',
        '.mjs',
        '.cjs',
        '.pac'
      ],
      aliases: [
        'JavaScript',
        'javascript',
        'js'
      ],
      configuration: './javascript-language-configuration.json'
    }],
    grammars: [{
      language: 'java',
      scopeName: 'source.java',
      path: './java-grammar.json'
    }, {
      language: 'json',
      scopeName: 'source.json',
      path: './json-grammar.json'
    }, {
      language: 'javascript',
      scopeName: 'source.js',
      path: './syntaxes/JavaScript.tmLanguage.json',
      embeddedLanguages: {
        'meta.tag.js': 'jsx-tags',
        'meta.tag.without-attributes.js': 'jsx-tags',
        'meta.tag.attributes.js': 'javascript',
        'meta.embedded.expression.js': 'javascript'
      },
      tokenTypes: {
        'meta.template.expression': 'other',
        'meta.template.expression string': 'string',
        'meta.template.expression comment': 'comment',
        'entity.name.type.instance.jsdoc': 'other',
        'entity.name.function.tagged-template': 'other',
        'meta.import string.quoted': 'other',
        'variable.other.jsdoc': 'other'
      }
    }]
  }
}
const { registerFile: registerExtensionFile } = registerExtension(extension)

registerExtensionFile('/java-configuration.json', async () => {
  return (await import('./resources/java-language-configuration.json?raw')).default
})
registerExtensionFile('/json-configuration.json', async () => {
  return (await import('./resources/json-language-configuration.json?raw')).default
})
registerExtensionFile('/javascript-language-configuration.json', async () => {
  return (await import('./resources/javascript-language-configuration.json?raw')).default
})

registerExtensionFile('/java-grammar.json', async () => {
  return (await import('./resources/java.tmLanguage.json?raw')).default
})
registerExtensionFile('/json-grammar.json', async () => {
  return (await import('./resources/JSON.tmLanguage.json?raw')).default
})
registerExtensionFile('./syntaxes/JavaScript.tmLanguage.json', async () => {
  return (await import('./resources/JavaScript.tmLanguage.json?raw')).default
})
