const assert = require('node:assert/strict')
require('sucrase/register/ts')
const { createEditor, $getRoot, $createParagraphNode, $createTextNode, $getSelection, INSERT_PARAGRAPH_COMMAND } = require('lexical')
const { LinkNode, $createLinkNode } = require('@lexical/link')
const { CodeNode, $createCodeNode } = require('@lexical/code')
const { registerRichText } = require('@lexical/rich-text')
const { registerUrlLinkOnEnter } = require('../src/shared/ui/lexical/plugins/url-link-plugin.ts')

function run(text, options = {}) {
  const editor = createEditor({ nodes: [LinkNode, CodeNode], onError: error => { throw error } })
  const cleanRichText = registerRichText(editor)
  const cleanLink = registerUrlLinkOnEnter(editor)
  editor.update(() => {
    const block = options.codeBlock ? $createCodeNode() : $createParagraphNode()
    const node = $createTextNode(text)
    if (options.inlineCode) node.setFormat('code')
    if (options.existingLink) block.append($createLinkNode('https://example.org').append(node))
    else block.append(node)
    $getRoot().append(block)
    node.select(options.offset ?? text.length, options.offset ?? text.length)
    if (options.selected) node.select(0, text.length)
  }, { discrete: true })
  if (options.readOnly) editor.setEditable(false)
  editor.update(() => editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND), { discrete: true })
  const state = editor.getEditorState().toJSON()
  if (options.followup) {
    editor.update(() => $getSelection().insertText('next line'), { discrete: true })
    assert.equal(editor.getEditorState().toJSON().root.children[1].children[0].type, 'text')
  }
  const restored = editor.parseEditorState(JSON.stringify(state)).toJSON()
  assert.deepEqual(restored, state, 'Saved link state round-trips')
  cleanLink()
  cleanRichText()
  return state.root.children
}
const url = 'https://github.com/dota-pilot1/prototype-pkt'
let blocks = run(url, { followup: true })
assert.equal(blocks.length, 2)
assert.equal(blocks[0].children[0].type, 'link')
assert.equal(blocks[0].children[0].url, url)
assert.equal(blocks[0].children[0].children[0].text, url)
assert.equal(blocks[1].children.length, 0)
assert.equal(run('주소: ' + url)[0].children[1].url, url)
assert.equal(run('www.example.com/path?q=1#section')[0].children[0].url, 'https://www.example.com/path?q=1#section')
for (const [text, options] of [
  ['ordinary text', {}], ['https://', {}], ['javascript:alert(1)', {}],
  [url, { inlineCode: true }], [url, { codeBlock: true }],
  [url, { offset: 10 }], [url, { selected: true }], [url, { readOnly: true }],
]) {
  blocks = run(text, options)
  assert(!JSON.stringify(blocks).includes('"type":"link"'), `Must not link: ${text} ${JSON.stringify(options)}`)
}
blocks = run(url, { existingLink: true })
assert.equal(blocks[0].children[0].url, 'https://example.org', 'Preserves existing link')
console.log('PASS: Enter conversion, newline/caret, www, prefix, code exclusions, invalid URLs, existing links, selection, read-only, JSON round-trip')
