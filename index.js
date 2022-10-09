const fs = require('fs');
const path = require('path');

const STATEMENT = 0;  
const STRING_D_QUOTES = 1;  
const STRING_S_QUOTES = 2;  
const REGEXP = 3 ; 
const ESCAPE = 4 ; 
const MULTI_LINE_COMMENT = 5 ;
const SINGLE_LINE_COMMENT = 6 ;
const REGEXP_CLASS  = 7; 

const directoryInputPath = path.join(__dirname, 'inputs');
const directoryOutputPath = path.join(__dirname, 'results');

fs.readdir(directoryInputPath, function(err, files) {
	if(err) {
		return;
	}
	files.forEach(function(file) {
		const text = fs.readFileSync(`${directoryInputPath}/${file}`, 'utf-8');
		fs.writeFileSync(`${directoryOutputPath}/${file}`, beautify(text), 'utf-8');
	});
});

function beautify(input) {
	var stmts = ['return', 'typeof', 'instanceof', 'break', 'continue', 'delete', 'in', 'new', 'throw'];

	var output = '';

	var indents = 0;
	var charIndx = 0;

	var character = '';
    var tokn = '';

	var scope = STATEMENT;
	var preEscp = 0;

	var exprOrStmt = true;

	var newLine = "\n";
	while(charIndx < input.length) {
		character = input.charAt(charIndx);
		pre = ''; 
		post = ''; 
		switch(character) {
			case '"':
				/* double quote */
				switch(scope) {
					case STRING_D_QUOTES:
						scope = STATEMENT;
						break;
					case ESCAPE:
						scope = preEscp;
						break;
					case STATEMENT:
						scope = STRING_D_QUOTES; /* start-of-string double quote */
						exprOrStmt = false;
				}
				break;
			case '\'':
				switch(scope) {
					case STRING_S_QUOTES:
						scope = STATEMENT;
						break; /* a non-escaped quote inside string terminates string */
					case ESCAPE:
						scope = preEscp;
						break; /* the quote was escaped, return to previous scope */
					case STATEMENT:
						scope = STRING_S_QUOTES; /* start-of-string single quote */
						exprOrStmt = false;
				}
				break;
			case '\\':
				if(scope == STRING_D_QUOTES || scope == STRING_S_QUOTES || scope == REGEXP || scope == REGEXP_CLASS) {
					preEscp = scope;
					scope = ESCAPE;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case '/':
				if(scope == STATEMENT) {
					tmp = input.charAt(charIndx + 1);
					if(tmp == '*') {
						/* start of multi-line comment */
						scope = MULTI_LINE_COMMENT;
					} else if(tmp == '/') {
						/* start of single-line comment */
						scope = SINGLE_LINE_COMMENT;
					} else if(exprOrStmt || stmts.contains(tokn)) {
						scope = REGEXP;
					}
				} else if(scope == ESCAPE) {
					scope = preEscp;
				} else if(scope == REGEXP) {
					scope = STATEMENT;
				} else if(scope == MULTI_LINE_COMMENT) {
					tmp = input.charAt(charIndx - 1);
					if(tmp == '*') {
						scope = STATEMENT;
					}
				}
				break;
			case '{':
				if(scope == STATEMENT) {
                
					if(lookAhead(input, charIndx, true) == '}') {
						charIndx = input.indexOf('}', charIndx);
						post = '}';
						break;
					}
					indents++;
                    
					if(input.charAt(charIndx + 1) != '\n') {
						post = newLine;
						post += repeat("\t", indents);
					}
					exprOrStmt = true;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case '}':
				if(scope == STATEMENT) {
					/* end-of-block curly brace */
					if(indents > 0) {
						indents--;
					}
					pre = newLine;
					pre += repeat("\t", indents);
					post = (input.charAt(charIndx + 1) != '\n' ? newLine : '') + repeat("\t", indents);
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case ';':
				if(scope == STATEMENT) {
					/* end-of-statement semicolon //, or between-variables comma */
					post = (input.charAt(charIndx + 1) != '\n' ? newLine : '');
					post += repeat("\t", indents);
					exprOrStmt = true;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case "\n":
				if(scope == SINGLE_LINE_COMMENT) {
					scope = STATEMENT;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
			case '(':
			case '!':
			case '=':
			case '-':
			case '+':
			case '?':
			case '*':
			case '&':
			case ':':
			case ',':
			case '|':
				if(scope == STATEMENT) {
					exprOrStmt = true;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case '[':
				if(scope == REGEXP) {
					scope = REGEXP_CLASS;
					exprOrStmt = false;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			case ']':
				if(scope == REGEXP_CLASS) {
					scope = REGEXP;
					exprOrStmt = false;
				} else if(scope == ESCAPE) {
					scope = preEscp;
				}
				break;
			default:
				if(scope == ESCAPE) {
					scope = preEscp;
				}
				if(scope == STATEMENT) {
					if(!(character == ' ' || character == '\t')) exprOrStmt = false;
				}
				break;
		}
		if(character.match(/[a-zA-Z0-9]/)) {
			/* if the previous character was whitespace or punctuation, this starts a new word.. */
			if(!input.charAt(charIndx - 1).match(/[a-zA-Z0-9]/)) {
				tokn = '';
			}
			tokn += character;
		}
		if(scope !== SINGLE_LINE_COMMENT && (scope !== MULTI_LINE_COMMENT && character !== '/')) {
			output += pre + character + post;
		}
		charIndx++;
	}
	return output;
}

function repeat(str, count) {
	return new Array(count).join(str);
}

function lookAhead(str, index, whitespaces) {
	/* returns next character, potentially ignoring whitespace */
	var chr = str.substr(index + 1, 1);
	while(whitespaces && index < str.length && /^\s+/.test(chr)) {
		index++;
		chr = str.substr(index + 1, 1);
	}
	return chr ? chr : '';
}