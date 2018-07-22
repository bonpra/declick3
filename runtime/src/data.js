// Private properties

//let _log = null;
let _classes = {};
let _translatedClasses = {};
let _instances = {};
let _stored = {};
let _interpreter = null;

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

let _toInterpreterData = function(data) {
  let result;
  if (data instanceof Array) {
    // Array
    result = _interpreter.createObject(_interpreter.ARRAY);
    for (let i = 0; i < data.length;i++) {
      _interpreter.setProperty(result, i, _toInterpreterData(data[i]));
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
      args.push(_toNativeData(arguments[i]));
    }
    return _toInterpreterData(_classes[className].prototype[methodName].apply(this.data, args));
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
      args.push(_toNativeData(arguments[i]));
    }
    return _toInterpreterData(_instances[className][methodName].apply(this.data, args));
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

/*let _logCommand = function(command) {
  if (typeof _log !== 'undefined') {
    _log.addCommand(command);
  }
};*/

let data = {

  initialize(interpreter) {

    _interpreter = interpreter;

    /*_interpreter = new Interpreter('', (interpreter, scope) => {
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
    });*/

  },

  toInterpreterData(data) {
    return _toInterpreterData(data);
  },

  toNativeData(data) {
    return _toNativeData(data);
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
      return _toInterpreterData(this.data[property]);
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
  }
};

// TODO: à bouger et à comprendre
Object.defineProperty(data, 'output', {
  get() {
    return _interpreter.value;
  }
});

export default data;
