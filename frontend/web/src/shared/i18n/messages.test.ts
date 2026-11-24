import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {accounts} from '../renewals/accounts/index.ts'
import {actions, failureReasons} from '../renewals/workflow/index.ts'

test('English messages have unique keys and cover workflow choices', () => {
  const raw = readFileSync(new URL('./messages/en.json', import.meta.url), 'utf8')
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.map(p => p.name && ts.isStringLiteral(p.name) ? p.name.text : '')
      assert.equal(new Set(keys).size, keys.length, 'duplicate key in ' + keys.join(', '))
    }
    ts.forEachChild(node, visit)
  }
  visit(ts.parseJsonText('en.json', raw))
  const {dashboard} = JSON.parse(raw)
  for (const key of actions) assert.ok(dashboard.actions[key], key)
  for (const key of failureReasons) assert.ok(dashboard.errors[key], key)
  for (const key of [...accounts.map(a => a.id), 'coveResolved']) assert.ok(dashboard.signals[key], key)
  assert.equal(dashboard.evidence, 'Evidence')
})
