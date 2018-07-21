import {plugins, parse, tokTypes, TokenType, keywordTypes} from 'acorn';

let _options = {locations: true, forbidReserved: 'everywhere', plugins: {declick:true} };

let _repeatKeyword = 'repeat';

tokTypes.repeat = keywordTypes.repeat = new TokenType('repeat', {isLoop:true, name:'repeat'});

// acorn plugin to handle repeat keyword and add additional info
plugins.declick = function(instance) {

  // add repeat keyword
  let keywordRegex = instance.keywords.toString();
  instance.keywords = new RegExp(keywordRegex.slice(1, -3) + '|' + _repeatKeyword + ')$');

  // set strict mode
  instance.strict = true;

  // detect repeat keyword
  instance.extend('parseStatement', (superFunction) => function(declaration, topLevel, exports) {
    if (this.type === tokTypes.repeat) {
      return this.parseRepeatStatement(this.startNode());
    }
    return superFunction.call(this, declaration, topLevel, exports);
  });

  // parse repeat statement
  instance.extend('parseRepeatStatement', (superFunction) => function(node) {
    this.next();
    this.expect(tokTypes.parenL);
    if (this.type === tokTypes.parenR) {
      node.count = null;
    } else {
      node.count = this.parseExpression();
    }
    this.expect(tokTypes.parenR);
    this.labels.push({kind: 'loop'});
    node.body = this.parseStatement(false);
    this.labels.pop();
    return this.finishNode(node, 'RepeatStatement');
  });

  // add 'raw' to every node
  instance.extend('finishNode', (superFunction) => function(node, type) {
    node = superFunction.call(this, node, type);
    node.raw = this.input.slice(node.start, node.end);
    return node;
  });
};

export default {

  setRepeatKeyword(name) {
    _repeatKeyword = name;
    tokTypes.repeat = keywordTypes[_repeatKeyword] = new TokenType('repeat', {isLoop:true, name:'repeat'});
  },

  parse(input, programName) {
    if (programName) {
      _options['sourceFile'] = programName;
    } else {
      _options['sourceFile'] = null;
    }
    return parse(input, _options);
  }
};

//TODO: avant chaque statement avait un "start" et un "end" avec les lignes de début et de fin. Mais a priori c'est dans le 'location' (à vérifier)