/*eslint-env mocha */
import {assert} from 'chai';
import Parser from '../src/parser';

describe('when encountering a repeat statement', () => {

  let code = `répéter(3) {
    bob.avancer(5)
  }`;

  before(() => {
    Parser.setRepeatKeyword('répéter');
  });

  it('should parse correctly a repeat statement', () => {
    let result = Parser.parse(code);
    assert.equal(result.body[0].type, 'RepeatStatement');
  });

  it('should set the count correctly', () => {
    let result = Parser.parse(code);
    assert.equal(result.body[0].count.value, 3);
  });

  it('should set the body correctly', () => {
    let result = Parser.parse(code);
    assert.equal(result.body[0].body.body[0].raw, 'bob.avancer(5)');
  });
});

