import {assert} from 'chai';
import {parse} from 'acorn';
import declickParser from '../src/parser';
import Interpreter from '../src/interpreter';

describe('Given an instance of Interpreter', () => {

  let interpreter;

  before(()=> {
    interpreter = new Interpreter('');
  });

  it('should interpret code correctly', () => {
    let code = `
    function abcd() {
      return 5;
    }
    a = 12
    for(i=0;i<10;i++) {
      a++
    }
    b = abcd();
    c = new String('bonjour, la valeur de a est ')
    d = c+a+' et la valeur de b est '+b
    `;
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(interpreter.value.data, 'bonjour, la valeur de a est 22 et la valeur de b est 5');

  });

  it('should interpret repeat statement with specified count correctly', () => {
    let code = `
    a = 12
    répéter(10) {
      a++
    }
    c = new String('bonjour, la valeur de a est ')
    d = c+a
    `;
    declickParser.setRepeatKeyword('répéter');
    let ast = declickParser.parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(interpreter.value.data, 'bonjour, la valeur de a est 22');

  });

  it('should interpret repeat statement without count correctly', () => {
    let code = `
    a = 12
    répéter() {
      a++
      if (a > 31) {
        break
      }
    }
    c = new String('bonjour, la valeur de a est ')
    d = c+a
    `;
    declickParser.setRepeatKeyword('répéter');
    let ast = declickParser.parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(interpreter.value.data, 'bonjour, la valeur de a est 32');

  });

  it('should handle try/catch correctly', () => {
    let code = `
    function abcd() {
      throw 'ERROR'
    }
    c = 'coucou'
    try {
      abcd()
    } catch (e) {
      c = e.toString()
    }
    d = c
    `;
    let ast = declickParser.parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(interpreter.value.data, 'ERROR');

  });

  it('should handle function insertion and inner call correctly', () => {
    let code1 = `
    c = 'coucou'
    `;
    let code2 = `
    c = 'je suis passé par ici'
    `;
    let ast1 = declickParser.parse(code1);
    let ast2 = declickParser.parse(code2);
    interpreter.appendCode(ast1);
    let functionStatement = interpreter.createFunctionStatement(ast2.body);
    interpreter.run();
    let innerCallStatement = interpreter.createCallStatement(functionStatement);
    interpreter.insertStatements(innerCallStatement);
    interpreter.run();
    assert.equal(interpreter.value.data, 'je suis passé par ici');
  });

  it('should insert function at the right place', () => {
    let code1 = `
    c = 1
    c++
    c = c+2
    c = c+3
    `;
    let code2 = `
    c = 50
    `;
    let ast1 = declickParser.parse(code1);
    let ast2 = declickParser.parse(code2);
    interpreter.appendCode(ast1);
    interpreter.step(); // Program
    interpreter.step(); // ?
    interpreter.step(); // Assignment
    interpreter.step(); // Left
    interpreter.step(); // Right
    interpreter.step(); // End of assignment
    let functionStatement = interpreter.createFunctionStatement(ast2.body);
    let innerCallStatement = interpreter.createCallStatement(functionStatement);
    interpreter.insertStatements(innerCallStatement);
    interpreter.run();
    assert.equal(interpreter.value, '56');
  });
});