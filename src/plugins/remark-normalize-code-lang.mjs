import { visit } from 'unist-util-visit'

/**
 * Normalize fenced code block language names.
 * e.g. ```Java -> ```java
 */
export function remarkNormalizeCodeLang() {
  const LANGUAGE_ALIAS_MAP = {
    // JVM
    kt: 'kotlin',
    kts: 'kotlin',

    // JS/TS
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',

    // Shell
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',

    // Data / config
    yml: 'yaml',
    md: 'markdown',
    conf: 'ini',
    config: 'ini',

    // SQL family
    mysql: 'sql',
    mariadb: 'sql',
    postgresql: 'sql',
    pgsql: 'sql',
    sqlite: 'sql',
    plsql: 'sql',
    sqlserver: 'sql',

    // C family
    'c++': 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    'h++': 'cpp',
    h: 'c',

    // .NET
    cs: 'csharp',
    'c#': 'csharp',
    fs: 'fsharp',
    'f#': 'fsharp',
  }

  return tree => {
    visit(tree, 'code', node => {
      if (typeof node.lang !== 'string') return

      const normalizedLang = node.lang.trim().toLowerCase()
      if (normalizedLang.length === 0) {
        node.lang = undefined
        return
      }

      node.lang = LANGUAGE_ALIAS_MAP[normalizedLang] ?? normalizedLang
    })
  }
}
