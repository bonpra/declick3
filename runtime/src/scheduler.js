import parser from './parser';
import Interpreter from './interpreter';
import data from './data';
import {isArray} from 'lodash';

// TODO: ajouter error
import DeclickError from './error';

const MAX_STEP = 100;

let _errorHandler = null;
let _stepCount = 0;
let _running = false;
let _priorityStatementsAllowed = true;
let _interpreter = null;
let _priorityInterpreter = null;
let _priorityStep = false;
const emptyAST = parser.parse('');

let _nextStep = function() {
  try {
    _priorityStep = false;
    let step = _priorityInterpreter.step();
    if (step) {
      _priorityStep = true;
    } else {
      step = _interpreter.step();
    }
    if (step) {
      _stepCount++;
      if (!(_priorityInterpreter.paused_ && _interpreter.paused_)) {
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
    let interpreter = _priorityStep ? _priorityInterpreter : _interpreter;
    if (!(err instanceof DeclickError)) {
      error = new DeclickError(err);
      if (interpreter.stateStack.length > 0) {
        state = interpreter.stateStack[0];
        if (state.node.loc) {
          error.setLines([state.node.loc.start.line, state.node.loc.end.line]);
        }
      }
      error.detectError();
    } else {
      error = err;
    }
    if (interpreter.stateStack.length > 0) {
      state = interpreter.stateStack[0];
      if (!state.node.loc || !state.node.loc.source) {
        // no program associated: remove lines if any
        error.setLines([]);
      } else {
        error.setProgramName(state.node.loc.source);
      }
    }
    _stop(interpreter.getGlobalScope());

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

let _stop = function(scope) {
  _running = false;
  if (!scope) {
    // TODO: find a way to clear scope, since polyfill_ is set to undefined
    scope = _interpreter.createScope(emptyAST, null);
  }
  _interpreter.stateStack = [{
    node: emptyAST,
    scope: scope,
    thisExpression: scope,
    done: false
  }];
  _priorityInterpreter.stateStack = [{
    node: emptyAST,
    scope: scope,
    thisExpression: scope,
    done: false
  }];
  _interpreter.paused_ = false;
  _priorityInterpreter.paused_ = false;
  _priorityStatementsAllowed = true;
};

let _clear = function() {
  _stop();
};

let _appendStatements = function(interpreter, statements, parameters, callback) {
  if (typeof parameters !== 'undefined') {
    for (let i = 0; i < parameters.length; i++) {
      parameters[i] = data.toInterpreterData(parameters[i]);
    }
  }
  if (callback != null) {
    interpreter.appendStatements(statements, parameters, interpreter.createCallbackStatement(callback));
  } else {
    interpreter.appendStatements(statements, parameters);
  }
};

let _insertStatements = function(interpreter, statements, parameters, callback) {
  if (typeof parameters !== 'undefined') {
    for (let i = 0; i < parameters.length; i++) {
      parameters[i] = data.toInterpreterData(parameters[i]);
    }
  }
  if (callback != null) {
    interpreter.insertStatements(statements, parameters, interpreter.createCallbackStatement(callback));
  } else {
    interpreter.insertStatements(statements, parameters);
  }
};

export default {

  /*setLog(element) {
    _log = element;
  },*/

  setErrorHandler(handler) {
    _errorHandler = handler;
  },
  // LIFECYCLE MANAGEMENT

  start() {
    _start();
  },

  interrupt() {
    // TODO: la ligne suivante est-elle vraiment nécessaire ?
    //_interpreter.stateStack.pop();
    _priorityInterpreter.stateStack.push({node:{type: 'InterruptStatement'}, priority:true, done:false});
  },

  clear() {
    _clear();
  },

  suspend() {
    _interpreter.paused_ = true;
    _priorityInterpreter.paused_ = true;
  },

  resume() {
    if (_interpreter.paused_) {
      _interpreter.paused_ = false;
      _priorityInterpreter.paused_ = false;
      _run();
    }
  },

  stop() {
    _stop();
  },

  // STATEMENTS MANAGEMENT

  addStatements(statements, parameters, callback) {
    if (isArray(statements)) {
      _appendStatements(_interpreter, parameters, callback);
    } else {
      // TODO: voir si on a besoin de gérer paramètres et callback dans ce cas
      _interpreter.appendCode(statements);
    }
    _start();
  },

  allowPriorityStatements() {
    _priorityStatementsAllowed = true;
  },

  refusePriorityStatements() {
    _priorityStatementsAllowed = false;
  },

  addPriorityStatements(statements, parameters, callback) {
    if (_priorityStatementsAllowed) {
      if (isArray(statements)) {
        _appendStatements(_priorityInterpreter, parameters, callback);
      } else {
        // TODO: voir si on a besoin de gérer les paramètres et le callback dans ce cas
        _priorityInterpreter.appendCode(statements);
      }
      _start();
    }
  },

  // TODO: est-ce qu'on gère le cas d'un Programme ?
  insertStatements(statements, parameters, callback) {
    _insertStatements(_interpreter, statements, parameters, callback);
    _start();
  },

  // TODO: voir si on s'en sert
  insertBlockStatement(blockStatement) {
    _interpreter.insertBlock(blockStatement);
    _start();
  },

  // TODO: est-ce qu'on gère le cas d'un Programme
  insertPriorityStatements(statements, parameters, callback) {
    if (_priorityStatementsAllowed) {
      _insertStatements(_priorityInterpreter, statements, parameters, callback);
      _start();
    }
  },

  initialize(initFunction) {
    _interpreter = new Interpreter('', initFunction);
    _priorityInterpreter = new Interpreter('');
    _priorityInterpreter.setGlobalScope(_interpreter.getGlobalScope());
    return _interpreter;
  },

  getLastValue() {
    return _priorityStep ? _priorityInterpreter.getLastValue() : _interpreter.getLastValue();
  }
};
