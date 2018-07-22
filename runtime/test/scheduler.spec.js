import {assert} from 'chai';
import declickParser from '../src/parser';
import scheduler from '../src/scheduler';

describe('When adding statements', () => {

  let interpreter;

  before(()=> {
    interpreter = scheduler.initialize();
    //scheduler.clear();
  });

  it('should execute added statements in right order', () => {
    let code1 = 'a = 3';
    let code2 = 'a = 5';
    let ast1 = declickParser.parse(code1);
    let ast2 = declickParser.parse(code2);
    scheduler.addStatements(ast1);
    scheduler.addStatements(ast2);
    assert.equal(scheduler.getLastValue().data, 5);
  });

  it('should insert statements before previously added statements', () => {
    let code1 = 'a = 3';
    let code2 = 'a = 5';
    let ast1 = declickParser.parse(code1);
    let ast2 = declickParser.parse(code2);
    scheduler.suspend();
    scheduler.addStatements(ast1);
    scheduler.insertStatements(ast2.body);
    scheduler.resume();
    assert.equal(scheduler.getLastValue().data, 3);
  });

  it('should execute priority statements first', () => {
    let code1 = 'a = 3';
    let code2 = 'a = 5';
    let ast1 = declickParser.parse(code1);
    let ast2 = declickParser.parse(code2);
    scheduler.suspend();
    scheduler.addStatements(ast1);
    scheduler.addPriorityStatements(ast2);
    scheduler.resume();
    assert.equal(scheduler.getLastValue().data, 3);
  });

});