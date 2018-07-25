/*eslint-env mocha */
import {assert} from 'chai';
import data from '../src/data';
import {parse} from 'acorn';

describe('When data has created interpreter', () => {

  beforeEach(()=> {
    data.reset();
  });

  it('should be able to add an instance to interpreter', () => {
    let result = false;
    let MyClass = class {
      constructor() {
        this.exposedMethods = {
          setResult:'exposedSetResult'
        };
      }
      setResult() {
        result = true;
      }
    };
    let myInstance = new MyClass();

    data.addInstance(myInstance, 'test');
    let interpreter = data.createInterpreter();
    let code = 'test.exposedSetResult()';
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(result, true);
  });

  it('should be able to add a class to interpreter', () => {
    let result = false;

    let MyClass = class {
      setResult() {
        result = true;
      }
    };

    MyClass.prototype.exposedMethods = {
      setResult:'exposedSetResult'
    };

    data.addClass(MyClass, 'Test');
    let interpreter = data.createInterpreter();
    let code = `toto = new Test()
    toto.exposedSetResult()`;
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(result, true);
  });

  it('should be able to add a class with its constructor to interpreter', () => {
    data.reset();
    let result = false;

    let MyClass = class {
      constructor(value) {
        this.registeredValue = value;
      }
      setResult() {
        result = this.registeredValue;
      }
    };

    MyClass.prototype.exposedMethods = {
      setResult:'exposedSetResult'
    };

    data.addClass(MyClass, 'Test');
    let interpreter = data.createInterpreter();
    let code = `toto = new Test('coucou')
    toto.exposedSetResult()`;
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(result, 'coucou');
  });

});