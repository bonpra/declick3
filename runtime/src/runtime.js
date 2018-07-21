import Interpreter from './interpreter';
import parser from './parser';
// TODO: ajouter error
import DeclickError from './error';

const MAX_STEP = 100;

// Private properties

//let _log = null;
let _errorHandler = null;
let _classes = {};
let _translatedClasses = {};
let _instances = {};
let _stored = {};
let _stepCount = 0;
let _interpreter = null;
let _running = false;
let _priorityStatementsAllowed = true;

// Private methods

let _getNativeData = function(data) {
  let result;
  if (data.type) {
    if (data.type === 'function') {
      return data;
    } else if (typeof data.data !== 'undefined') {
      // primitive data or declick objects
      return data.data;
    } else if (data.type === 'object') {
      if (typeof data.length !== 'undefined') {
        // we are in an array
        result = [];
        for (let i = 0; i < data.length; i++) {
          result.push(_getNativeData(data.properties[i]));
        }
        return result;
      }
      result = {};
      for (let member in data.properties) {
        result[member] = _getNativeData(data.properties[member]);
      }
      return result;
    }
  }
  return data;
};

let _getInterpreterData = function(data) {
  let result;
  if (data instanceof Array) {
    // Array
    result = _interpreter.createObject(_interpreter.ARRAY);
    for (let i = 0; i < data.length;i++) {
      _interpreter.setProperty(result, i, _getInterpreterData(data[i]));
    }
    return result;
  } else if (typeof data === 'object') {
    // Object
    if (data.className) {
      // declick object: wrap it
      if (_translatedClasses[data.className]) {
        result = _interpreter.createObject(_getClass(_translatedClasses[data.className]));
        result.data = data;
        return result;
      }
    }
  } else {
    // Primitive types
    return _interpreter.createPrimitive(data);
  }
  return data;
};

let _getClassMethodWrapper = function(className, methodName) {
  return function() {
    // transform data from interpreter into actual data
    let args = [];
    for (let i = 0; i < arguments.length;i++) {
      args.push(_getNativeData(arguments[i]));
    }
    return _getInterpreterData(_classes[className].prototype[methodName].apply(this.data, args));
  };
};

//TODO: store classes
let _getClass = function(name) {
  let parent = _interpreter.createObject(_interpreter.FUNCTION);
  if (typeof _classes[name].prototype !== 'undefined' && typeof _classes[name].prototype.translatedMethods !== 'undefined') {
    let translated = _classes[name].prototype.translatedMethods;
    for (let methodName in translated) {
      _interpreter.setProperty(parent.properties.prototype, translated[methodName], _interpreter.createNativeFunction(_getClassMethodWrapper(name, methodName)));
    }
  }
  return parent;
};

let _getInstanceMethodWrapper = function(className, methodName) {
  return function() {
    // transform data from interpreter into actual data
    let args = [];
    for (let i = 0 ; i < arguments.length ; i++) {
      args.push(_getNativeData(arguments[i]));
    }
    return _getInterpreterData(_instances[className][methodName].apply(this.data, args));
  };
};

let _getInstance = function(name) {
  let object = _interpreter.createObject(_interpreter.FUNCTION);
  object.data = _instances[name];
  if (typeof _instances[name].translatedMethods !== 'undefined') {
    let translated = _instances[name].translatedMethods;
    for (let methodName in translated) {
      _interpreter.setProperty(object, translated[methodName], _interpreter.createNativeFunction(_getInstanceMethodWrapper(name, methodName)));
    }
  }
  return object;
};

// generate wrapper for translated methods
let _getObject = function(name) {
  let wrapper = function() {
    let obj = _interpreter.createObject(_getClass(name));
    let declickObj = Object.create(_classes[name].prototype);
    // transform data from interpreter into actual data
    let args = [];
    for (let i = 0; i < arguments.length;i++) {
      args.push(_getNativeData(arguments[i]));
    }
    _classes[name].apply(declickObj, args);
    obj.data = declickObj;
    return obj;
  };
  return _interpreter.createNativeFunction(wrapper);
};

let _stop = function(scope) {
  _running = false;
  let emptyAST = parser.parse('');
  if (!scope) {
    scope = _interpreter.createScope(emptyAST, null);
  }
  _interpreter.stateStack = [{
    node: emptyAST,
    scope: scope,
    thisExpression: scope,
    done: false
  }];
  _interpreter.paused_ = false;
  _priorityStatementsAllowed = true;
};

let _clear = function() {
  _stop();
};

/*let _logCommand = function(command) {
  if (typeof _log !== 'undefined') {
    _log.addCommand(command);
  }
};*/

let _nextStep = function() {
  try {
    if (_interpreter.step()) {
      _stepCount++;
      if (!_interpreter.paused_) {
        if (_stepCount >= MAX_STEP) {
          _stepCount = 0;
          window.setTimeout(_nextStep, 0);
        } else {
          _nextStep();
        }
      }
    } else {
      _running = false;
    }
    // _logCommand(_interpreter.stateStack);
  } catch (err) {
    let state, error;
    if (!(err instanceof DeclickError)) {
      error = new DeclickError(err);
      if (_interpreter.stateStack.length > 0) {
        state = _interpreter.stateStack[0];
        if (state.node.loc) {
          error.setLines([state.node.loc.start.line, state.node.loc.end.line]);
        }
      }
      error.detectError();
    } else {
      error = err;
    }
    if (_interpreter.stateStack.length > 0) {
      state = _interpreter.stateStack[0];
      if (!state.node.loc || !state.node.loc.source) {
        // no program associated: remove lines if any
        error.setLines([]);
      } else {
        error.setProgramName(state.node.loc.source);
      }
    }
    let baseState = _interpreter.stateStack.pop();
    _stop(baseState.scope);

    if (typeof _errorHandler !== 'undefined') {
      _errorHandler(error);
    } else {
      throw error;
    }
  }
};

let _run = function() {
  _running = true;
  _nextStep();
};

let _start = function() {
  if (!_running) {
    _stepCount = 0;
    _run();
  }
};

let Runtime = {

  convertToNative(data) {
    return _getNativeData(data);
  },

  /*setLog(element) {
    _log = element;
  },*/

  setErrorHandler(handler) {
    _errorHandler = handler;
  },

  initialize() {

    _interpreter = new Interpreter('', (interpreter, scope) => {
      // #1 Declare translated Instances
      for (let name in _instances) {
        let object;
        if (_stored[name]) {
          // instance already created and stored
          object = _stored[name];
        } else {
          object = _getInstance(name);
          _stored[name] = object;
        }
        _interpreter.setProperty(scope, name, object, true);
      }

      // #2 Declare translated Classes
      for (let name in _classes) {
        let object;
        if (_stored[name]) {
          // instance already created and stored
          object = _stored[name];
        } else {
          object = _getObject(name);
          _stored[name] = object;
        }
        _interpreter.setProperty(scope, name, object, true);
      }
    });

  },

  // LIFECYCLE MANAGEMENT

  start() {
    _start();
  },

  interrupt() {
    _interpreter.stateStack.shift();
    _interpreter.stateStack.unshift({node:{type: 'InterruptStatement'}, priority:true, done:false});
  },

  clear() {
    _clear();
  },

  suspend() {
    _interpreter.paused_ = true;
  },

  resume() {
    if (_interpreter.paused_) {
      _interpreter.paused_ = false;
      _run();
    }
  },

  stop() {
    _stop();
  },

  // STATEMENTS MANAGEMENT

  addStatement(statement) {
    _interpreter.appendCode(statement);
    _start();
  },

  addStatements(statements) {
    _interpreter.appendCode(statements);
    _start();
  },

  insertStatement(statement, parameters) {
    _interpreter.insertCode(statement, true, parameters);
    _start();
  },

  insertStatements(statements) {
    _interpreter.insertBlock(statements, false);
    _start();
  },

  addPriorityStatements(statements, parameters, log, callback) {
    if (_priorityStatementsAllowed) {
      if (typeof parameters !== 'undefined') {
        for (let i = 0; i < parameters.length; i++) {
          parameters[i] = _getInterpreterData(parameters[i]);
        }
      }
      if (typeof callback !== 'undefined') {
        _interpreter.insertCode(statements, true, parameters, this.createCallbackStatement(callback));
      } else {
        _interpreter.insertCode(statements, true, parameters);
      }
      _start();
    }
  },

  addClass(func, name) {
    _classes[name] = func;
    if (func.prototype.className) {
      _translatedClasses[func.prototype.className] = name;
    }
  },

  addInstance(func, name) {
    _instances[name] = func;
  },

  getClass(name) {
    if (_classes[name]) {
      return _classes[name];
    }
    return null;
  },

  getObject(name) {
    try {
      let obj = _interpreter.getValueFromScope(name);
      if (obj && obj.data) {
        return obj.data;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  getObjectName(reference) {
    let scope = _interpreter.getScope();
    while (scope) {
      for (let name in scope.properties) {
        let obj = scope.properties[name];
        if (obj.data && obj.data === reference) {
          return name;
        }
      }
      scope = scope.parentScope;
    }
    return null;
  },

  deleteObject(reference) {
    let scope = _interpreter.getScope();
    while (scope) {
      for (let name in scope.properties) {
        let obj = scope.properties[name];
        if (!scope.notWritable[name] && obj.data) {
          if (obj.data === reference) {
            _interpreter.deleteProperty(scope, name);
            return true;
          }
        }
      }
      scope = scope.parentScope;
    }
    return false;
  },

  exposeProperty(reference, property, propertyName) {
    let scope = _interpreter.getScope();
    let wrapper = function() {
      return _getInterpreterData(this.data[property]);
    };
    while (scope) {
      for (let name in scope.properties) {
        let obj = scope.properties[name];
        if (obj.data === reference) {
          let prop = _interpreter.createObject(null);
          prop.dynamic = wrapper;
          _interpreter.setProperty(obj, propertyName, prop);
          return true;
        }
      }
      scope = scope.parentScope;
    }
    return false;
  },

  createCallStatement(functionStatement) {
    return _interpreter.createCallStatement(functionStatement);
  },

  createFunctionStatement(functionStatement) {
    return _interpreter.createFunctionStatement(functionStatement);
  },

  allowPriorityStatements() {
    _priorityStatementsAllowed = true;
  },

  refusePriorityStatements() {
    _priorityStatementsAllowed = false;
  }

};

// TODO: à comprendre
Object.defineProperty(Runtime, 'output', {
  get() {
    return _interpreter.value;
  }
});

export default Runtime;
