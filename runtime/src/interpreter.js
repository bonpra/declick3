import JSInterpreter from 'js-interpreter';

export default class extends JSInterpreter {

  // TODO: voir pourquoi ?
  stepFunctionDeclaration() {
    var state = this.stateStack.pop();
    this.setValue(this.createPrimitive(state.node.id.name), this.createFunction(state.node, this.getScope()));
  }

  // Modify Interpreter to throw exception when trying to redefine readonly property
  // TODO: est-ce toujours nécessaire ?
  setValueToScope(name, value) {
    var scope = this.getScope();
    var strict = scope.strict;
    var nameStr = name.toString();
    while (scope) {
      if ((nameStr in scope.properties) || (!strict && !scope.parentScope)) {
        if (!scope.notWritable[nameStr]) {
          scope.properties[nameStr] = value;
        } else {
          this.throwException(this.REFERENCE_ERROR, nameStr + ' is already defined');
        }
        return;
      }
      scope = scope.parentScope;
    }
    this.throwException(this.REFERENCE_ERROR, nameStr + ' is not defined');
  }

  // Modify Interpreter to not delete statements when looking for a try and to use catch
  executeException(error) {
    // Search for a try statement.
    let state;
    let i = this.stateStack.length - 1;
    do {
      state = this.stateStack[i];
      i--;
    } while (i >= 0 && state.node.type !== 'TryStatement');
    if (state.node.type === 'TryStatement') {
      this.stateStack.splice(i + 1);
      this.stateStack.push({
        node: state.node.handler,
        throwValue: error
      });
      return;
    }
    // Throw a real error.
    let realError;
    if (this.isa(error, this.ERROR)) {
      let errorTable = {
        'EvalError': EvalError,
        'RangeError': RangeError,
        'ReferenceError': ReferenceError,
        'SyntaxError': SyntaxError,
        'TypeError': TypeError,
        'URIError': URIError
      };
      let name = this.getProperty(error, 'name').toString();
      let message = this.getProperty(error, 'message').valueOf();
      let type = errorTable[name] || Error;
      realError = type(message);
    } else {
      realError = error.toString();
    }
    throw realError;
  }

  // add support for Repeat statement
  stepRepeatStatement() {
    let state = this.stateStack[this.stateStack.length - 1];
    state.isLoop = true;
    let node = state.node;
    if (state.countHandled) {
      if (node.body) {
        if (state.infinite) {
          this.stateStack.push({node: node.body});
        } else {
          state.count--;
          if (state.count >= 0) {
            this.stateStack.push({node: node.body});
          } else {
            this.stateStack.pop();
          }
        }
      }
    } else {
      if (node.count) {
        // count specified
        if (state.countReady) {
          state.infinite = false;
          state.count = state.value;
          state.countHandled = true;
        } else {
          state.countReady = true;
          this.stateStack.push({node: node.count});
        }
      } else {
        state.infinite = true;
        state.countHandled = true;
      }
    }
  }

  // add support for inner call
  stepInnerCallExpression() {
    let state = this.stateStack.pop();
    let args = state.parameters ? state.parameters : state.node.parameters ? state.node.parameters : [];
    this.stateStack.push({node: {type:'CallExpression', arguments:args}, arguments_:[], n_:0, doneCallee_: true, func_: state.node.func_, funcThis_: this.stateStack[0].thisExpression});
  }

  // TODO: voir si on ne peut pas plutôt créer le callbackStatement depuis un callback
  appendStatements(statements, parameters, callbackStatement) {
    let body = [];
    for (let i = statements.length - 1; i >= 0; i--) {
      let node = statements[i];
      if (node.type === 'InnerCallExpression' && parameters != null) {
        node.parameters = parameters;
      }
      body.push(node);
    }
    if (callbackStatement != null) {
      body.push(callbackStatement);
    }
    this.appendCode({type:'Program', body:body});
  }

  //TODO: voir si on s'en sert
  insertBlock(block) {
    // Append the new statements
    block.type = 'BlockStatement';
    this.stateStack.push({node: block, done:false});
  }

  // add ability to insert code
  insertStatements(statements, parameters, callbackStatement) {
    // Append the new statements
    if (typeof callbackStatement !== 'undefined') {
      this.stateStack.push({node: callbackStatement, done:false});
    }
    for (let i = statements.length - 1; i >= 0; i--) {
      let node = statements[i];
      if (node.type === 'InnerCallExpression' && typeof parameters !== 'undefined') {
        // Add parameter
        this.stateStack.push({node: node, done:false, parameters:parameters});
      } else {
        this.stateStack.push({node: node, done:false});
      }
    }
  }

  // add ability to handle dynamic properties
  getProperty(obj, name) {
    if (typeof (name)) {
      name = name.toString();
    }
    if (obj === this.UNDEFINED || obj === this.NULL) {
      this.throwException(this.TYPE_ERROR, "Cannot read property '" + name + "' of " + obj);
    }
    // Special cases for magic length property.
    if (this.isa(obj, this.STRING)) {
      if (name === 'length') {
        return this.createPrimitive(obj.data.length);
      }
      let n = this.arrayIndex(name);
      if (!isNaN(n) && n < obj.data.length) {
        return this.createPrimitive(obj.data[n]);
      }
    } else if (this.isa(obj, this.ARRAY) && name === 'length') {
      return this.createPrimitive(obj.length);
    }
    while (true) {
      if (obj.properties && name in obj.properties) {
        let prop = obj.properties[name];
        if (prop.dynamic) {
          return prop.dynamic.apply(obj);
        }
        let getter = obj.getter[name];
        if (getter) {
          getter.isGetter = true;
          return getter;
        }
        return prop;
      }
      if (obj.parent && obj.parent.properties && obj.parent.properties.prototype) {
        obj = obj.parent.properties.prototype;
      } else {
        // No parent, reached the top.
        break;
      }
    }
    return this.UNDEFINED;
  }

  // change break management in order not to remove root program node
  stepBreakStatement() {
    var state = this.stateStack.pop();
    var node = state.node;
    var label = null;
    if (node.label) {
      label = node.label.name;
    }
    state = this.stateStack.pop();
    while (state && state.node.type !== 'CallExpression' && state.node.type !== 'NewExpression' && state.node.type !== 'Program') {
      if (label ? label === state.label : (state.isLoop || state.isSwitch)) {
        return;
      }
      state = this.stateStack.pop();
    }
    if (state.node.type === 'Program') {
      // re-insert root node
      this.stateStack.push(state);
    } else {
      // Syntax error, do not allow this error to be trapped.
      throw SyntaxError('Illegal break statement');
    }
  }

  // TODO: A Corriger puisque l'ordre est maintenant inversé
  // handle interrupt statements
  stepInterruptStatement() {
    var state = this.stateStack.shift();
    var node = state.node;
    var label = null;
    if (node.label) {
      label = node.label.name;
    }
    // Find index at which search has to start
    let index = this.stateStack.length - 1;
    while (index >= 0 && !this.stateStack[index].priority) {
      index--;
    }
    index++;

    state = this.stateStack.splice(index, 1)[0];
    while (state && state.node.type !== 'Program') {
      if (label ? label === state.label : (state.isLoop || state.isSwitch)) {
        return;
      }
      state = this.stateStack.splice(index, 1)[0];
    }
    if (state.node.type === 'Program') {
      // re-insert root node
      this.stateStack.push(state);
    } else {
      // Syntax error, do not allow this error to be trapped.
      throw SyntaxError('Illegal break statement');
    }
  }

  // handle callback statements
  stepCallbackStatement() {
    var state = this.stateStack.pop();
    var node = state.node;
    if (node.callback) {
      node.callback.apply(this);
    }
    let index = this.stateStack.length - 1;
    if (typeof state.value !== 'undefined' && state.value !== this.UNDEFINED && this.stateStack[index].node.type === 'CallExpression') {
      this.stateStack[index].value = state.value;
    }
  }

  createCallStatement(functionStatement) {
    return {type: 'InnerCallExpression', arguments: [], func_: functionStatement, loc: functionStatement.node.loc};
  }

  createCallbackStatement(callback) {
    return {type: 'CallbackStatement', callback: callback};
  }

  createFunctionStatement(body, parameters) {
    if (typeof parameters === 'undefined') {
      parameters = [];
    }
    let node = {type:'FunctionExpression', body:{type:'BlockStatement', body:body}, params:parameters};
    let statement = this.createFunction(node, this.getScope());
    return statement;
  }

  getGlobalScope() {
    return this.global;
  }

  setGlobalScope(aScope) {
    this.stateStack[0].scope = aScope;
  }

  getLastValue() {
    return this.value;
  }
};