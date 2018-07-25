import {assert} from 'chai';
import data from '../src/data';
import {parse} from 'acorn';

describe('When data has created interpreter', () => {

  it('should add an instance to interpreter', () => {
    let result = false;
    class MyClass {
      constructor() {
        this.exposedMethods = {
          setResult:'exposedSetResult'
        };
      }
      setResult() {
        result = true;
      }
    }
    let myInstance = new MyClass();

    data.addInstance(myInstance, 'test');
    let interpreter = data.createInterpreter();
    let code = 'test.exposedSetResult()';
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(result, true);
  });

});