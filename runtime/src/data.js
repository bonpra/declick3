import Interpreter from './interpreter';
import {forIn} from 'lodash';
// Private properties

//let _log = null;
let _classes = {};
// classes without constructor
let _classStructures = {};
let _instances = {};
let _interpreter = null;
let _stored = false;

// Private methods

let _toNativeData = function(data) {
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
          result.push(_toNativeData(data.properties[i]));
        }
        return result;
      }
      result = {};
      for (let member in data.properties) {
        result[member] = _toNativeData(data.properties[member]);
      }
      return result;
    }
  }
  return data;
};

let _toInterpreterData = function(interpreter, data) {
  let result;
  if (data instanceof Array) {
    // Array
    result = interpreter.createObject(interpreter.ARRAY);
    data.forEach((element, index) => {
      interpreter.setProperty(result, index, _toInterpreterData(interpreter, element));
    });
    return result;
  } else if (typeof data === 'object') {
    // Object
    if (data.className != null && _classStructures[data.className] != null) {
      // declick object: wrap it
      let result = interpreter.createObject(_classStructures[data.className]);
      result.data = data;
      return result;
    }
    return interpreter.createObject(data);
  }
  // Primitive types
  return interpreter.createPrimitive(data);
};

let _getMethodWrapper = function(interpreter, method) {
  return function() {
    // transform data from interpreter into actual data
    let args = [...arguments].map((argument) => {
      return _toNativeData(argument);
    });
    return _toInterpreterData(interpreter, method.apply(this.data, args));
  };
};

let _toInterpreterClass = function(interpreter, AClass) {
  // 1st prototype
  let interpreterClass = interpreter.createObject(interpreter.FUNCTION);
  if (AClass.prototype != null && AClass.prototype.exposedMethods != null) {
    forIn(AClass.prototype.exposedMethods, (exposedName, methodName) => {
      interpreter.setProperty(interpreterClass.properties.prototype, exposedName, interpreter.createNativeFunction(_getMethodWrapper(interpreter, AClass.prototype[methodName])));
    });
  }
  // store class prototype to be able to create interpreter objects from native ones
  if (AClass.prototype.className != null) {
    _classStructures[AClass.prototype.className] = interpreterClass;
  }
  // 2nd constructor
  let constructor = function() {
    let instance = interpreter.createObject(interpreterClass);
    let args = [...arguments].map((argument) => {
      return _toNativeData(argument);
    });
    //TODO: voir si on peut définitivement oublier la version function:
    //let declickObject = Object.create(AClass);
    //AClass.apply(declickObject, args);
    let declickObject = new AClass(...args);
    instance.data = declickObject;
    return instance;
  };
  return interpreter.createNativeFunction(constructor);
};

let _toInterpreterInstance = function(interpreter, instance) {
  let interpreterInstance = interpreter.createObject(interpreter.FUNCTION);
  interpreterInstance.data = instance;
  if (instance.exposedMethods != null) {
    forIn(instance.exposedMethods, (exposedName, methodName) => {
      interpreter.setProperty(interpreterInstance, exposedName, interpreter.createNativeFunction(_getMethodWrapper(interpreter, instance[methodName])));
    });
  }
  return interpreterInstance;
};

/*let _logCommand = function(command) {
  if (typeof _log !== 'undefined') {
    _log.addCommand(command);
  }
};*/

let data = {

  createInterpreter() {
    _interpreter = new Interpreter('', (interpreter, scope) => {

      // at first launch, create and store interpreter instances and classes
      if (!_stored) {
        forIn(_instances, (instance, name) => {
          _instances[name] = _toInterpreterInstance(interpreter, instance);
        });
        forIn(_classes, (aClass, name) => {
          _classes[name] = _toInterpreterClass(interpreter, aClass);
        });
        _stored = true;
      }

      // #1 Declare instances
      forIn(_instances, (instance, name) => {
        interpreter.setProperty(scope, name, instance, {writable:false});
      });

      // #2 Declare classes
      forIn(_classes, (aClass, name) => {
        interpreter.setProperty(scope, name, aClass, {writable:false});
      });
    });

    return _interpreter;
  },

  toInterpreterData(data) {
    return _toInterpreterData(_interpreter, data);
  },

  toNativeData(data) {
    return _toNativeData(data);
  },

  addClass(aClass, name) {
    _classes[name] = aClass;
  },

  addInstance(instance, name) {
    _instances[name] = instance;
  },

  getClass(name) {
    if (_classes[name]) {
      return _classes[name];
    }
    return null;
  },

  findInterpreterObject(name) {
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

  findInterpreterObjectName(reference) {
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

  deleteInterpreterObject(reference) {
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
      return _toInterpreterData(_interpreter, this.data[property]);
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

  reset() {
    _classes = {};
    _classStructures = {};
    _instances = {};
    _interpreter = null;
    _stored = false;
  }
};

// TODO: à bouger et à comprendre
/*Object.defineProperty(data, 'output', {
  get() {
    return _interpreter.value;
  }
});*/

export default data;
