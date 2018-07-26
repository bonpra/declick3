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

    assert.ok(result);
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

    assert.ok(result);
  });

  it('should be able to add a class with its constructor to interpreter', () => {
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

  it('should be able to retrieve a declared instance from interpreter', () => {
    let result = false;
    let MyClass = class {
      setResult() {
        result = this;
      }
    };

    MyClass.prototype.exposedMethods = {
      setResult:'exposedSetResult'
    };

    let myInstance = new MyClass();

    data.addInstance(myInstance, 'testInstance');
    let interpreter = data.createInterpreter();
    let code = 'testInstance.exposedSetResult()';
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();

    assert.equal(data.toNativeData(result), myInstance);
  });

  it('should be able to retrieve an instance of a declared class from interpreter', () => {
    let result = false;
    let MyClass = class {
      constructor(value) {
        this.secretText = value;
      }
      setResult() {
        result = this;
      }
      getActualResult() {
        return this.secretText;
      }
    };

    MyClass.prototype.exposedMethods = {
      setResult:'exposedSetResult'
    };

    data.addClass(MyClass, 'ATestClass');
    let interpreter = data.createInterpreter();
    let code = `toto = new ATestClass('yes')
    toto.exposedSetResult()`;
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();
    let retrievedInstance = data.toNativeData(result);
    assert.equal(retrievedInstance.getActualResult(), 'yes');
  });

  it('should be able to inject an instance of a declared class into the interpreter', () => {
    let result = false;
    let MyClass = class {
      constructor(value) {
        this.secretValue = value;
      }
      setResult(value) {
        result = value;
      }
      getSecretValue() {
        return this.secretValue;
      }
    };

    MyClass.prototype.exposedMethods = {
      getSecretValue:'exposedGetSecretValue',
      setResult:'exposedSetResult'
    };

    MyClass.prototype.className = 'aStringUsedToRetrieveTheClass';

    data.addClass(MyClass, 'ATestClass');
    let interpreter = data.createInterpreter();
    let instance = new MyClass(53);
    let interpreterInstance = data.toInterpreterData(instance);
    interpreter.setProperty(interpreter.getGlobalScope(), 'injectedInstance', interpreterInstance);
    let code = `a = injectedInstance.exposedGetSecretValue()
    injectedInstance.exposedSetResult(a*3)`;
    let ast = parse(code);
    interpreter.appendCode(ast);
    interpreter.run();
    assert.equal(result, 53 * 3);

  });

  it('it should prevent from redeclaring an declared instance', () => {
    let MyClass = class {
      constructor() {
        this.exposedMethods = {
          setResult:'exposedSetResult'
        };
      }
      setResult() {
      }
    };
    let myInstance = new MyClass();

    data.addInstance(myInstance, 'test');
    let interpreter = data.createInterpreter();
    let code = 'test = 5';
    let ast = parse(code);
    interpreter.appendCode(ast);
    assert.throw(interpreter.run.bind(interpreter), TypeError);
  });

  describe('When interpreter is reset', () => {

    beforeEach(()=> {
      data.reset();
    });

    it('should clear reference to a previously created object', () => {

      let MyClass = class {
        setResult() {
        }
      };

      MyClass.prototype.exposedMethods = {
        setResult:'exposedSetResult'
      };

      data.addClass(MyClass, 'Test');
      let interpreter = data.createInterpreter();
      let code = 'toto = new Test()';
      let ast = parse(code);
      interpreter.appendCode(ast);
      interpreter.run();
      interpreter.reset();
      code = 'toto.exposedSetResult()';
      ast = parse(code);
      interpreter.appendCode(ast);
      assert.throws(interpreter.run.bind(interpreter), ReferenceError);
    });

    it('should be able to create an instance of a class declared previously', () => {
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
      interpreter.reset();
      let code = `toto = new Test()
      toto.exposedSetResult()`;
      let ast = parse(code);
      interpreter.appendCode(ast);
      interpreter.run();
      assert.ok(result);
    });

    it('should be able to call an instance declared previously', () => {
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
      interpreter.reset();
      let code = 'test.exposedSetResult()';
      let ast = parse(code);
      interpreter.appendCode(ast);
      interpreter.run();
      assert.ok(result);
    });
  });

  after(() => {
    data.reset();
  });
});