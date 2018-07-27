import _data from './data';
import _scheduler from './scheduler';
import _parser from './parser';

let _interpreter = null;

export default {

  initialize(classes, instances) {

    for (let name in classes) {
      _data.addClass(classes[name], name);
    }

    for (let name in instances) {
      _data.addInstance(instances[name], name);
    }

    _interpreter = _data.createInterpreter();

    _scheduler.initialize(_interpreter);

  },

  getDeclickObjectName(reference) {
    if (reference.objectName == null) {
      reference.objectName = _data.findInterpreterObjectName(reference);
    }
    return reference.objectName;
  },

  suspend() {
    _scheduler.clear();
  },

  resume() {
    _scheduler.resume();
  },

  clear() {
    _data.clear();
    _scheduler.clear();
  },

  executeCode(code) {
    _scheduler.addStatements(_parser.parse(code));
  },

  executeStatements(statements) {
    _scheduler.addStatements(statements);
  },

  executePriorityCode(code) {
    _scheduler.addPriorityStatements(_parser.parse(code));
  },

  executePriorityStatements(statements) {
    _scheduler.addPriorityStatements(statements);
  },

  getStatements(code) {
    return _parser.parse(code);
  },

  getLastValue() {
    return _scheduler.getLastValue();
  },

  reset() {
    _scheduler.clear();
    _data.reset();
  }

};
