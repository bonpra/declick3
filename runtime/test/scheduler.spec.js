/*eslint-env mocha */
import {assert} from 'chai';
import {parse} from 'acorn';
import Interpreter from '../src/interpreter';
import scheduler from '../src/scheduler';

describe('When scheduer is initialized', () => {
  let interpreter = new Interpreter('');
  scheduler.initialize(interpreter);

  beforeEach(()=> {
    scheduler.clear();
  });

  describe('When executing a statement', () => {

    it('should give last value for a normal statement', () => {
      let code1 = 'a = 3';
      let ast1 = parse(code1);
      scheduler.addStatements(ast1);
      assert.equal(scheduler.getLastValue().data, 3);
    });

    it('should give last value for a priority statement', () => {
      let code1 = 'a = 27';
      let ast1 = parse(code1);
      scheduler.addPriorityStatements(ast1);
      assert.equal(scheduler.getLastValue().data, 27);
    });

  });

  describe('When adding statements', () => {

    it('should execute added statements from a whole Program', () => {
      let code1 = `
      function truc(c) {
        return c+12
      }
      a = 3
      truc(a)`;
      let ast1 = parse(code1);
      scheduler.addStatements(ast1);
      assert.equal(scheduler.getLastValue().data, 15);
    });

    it('should execute added statements from an array', () => {
      let code1 = `
      function truc(c) {
        return c+14
      }
      a = 3
      truc(a)`;
      let ast1 = parse(code1);
      scheduler.addStatements(ast1.body);
      assert.equal(scheduler.getLastValue().data, 17);
    });

    it('should execute added statements in right order', () => {
      let code1 = 'a = 3';
      let code2 = 'a = 5';
      let ast1 = parse(code1);
      let ast2 = parse(code2);
      scheduler.addStatements(ast1);
      scheduler.addStatements(ast2);
      assert.equal(scheduler.getLastValue().data, 5);
    });

    it('should insert statements before previously added statements', () => {
      let code1 = 'a = 3';
      let code2 = 'a = 5';
      let ast1 = parse(code1);
      let ast2 = parse(code2);
      scheduler.suspend();
      scheduler.addStatements(ast1);
      scheduler.insertStatements(ast2.body);
      scheduler.resume();
      assert.equal(scheduler.getLastValue().data, 3);
    });

    it('should execute priority statements first', () => {
      let code1 = 'a = b+3';
      let code2 = `
      a = 5
      b = 10`;
      let ast1 = parse(code1);
      let ast2 = parse(code2);
      scheduler.suspend();
      scheduler.addStatements(ast1);
      scheduler.addPriorityStatements(ast2);
      scheduler.resume();
      assert.equal(scheduler.getLastValue().data, 13);
    });

    it('should insert priority statements before previously added priority statements', () => {
      let code1 = 'a = 3';
      let code2 = 'a = 5';
      let ast1 = parse(code1);
      let ast2 = parse(code2);
      scheduler.suspend();
      scheduler.addPriorityStatements(ast1);
      scheduler.insertPriorityStatements(ast2);
      scheduler.resume();
      assert.equal(scheduler.getLastValue().data, 3);
    });

    it('should execute callback when provided', () => {
      let code1 = 'a = 142';
      let result;
      let callback = () => {
        result = scheduler.getLastValue().data;
      };
      let ast1 = parse(code1);
      scheduler.addStatements(ast1, null, callback);
      assert.equal(result, 142);
    });
  });
});