//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

//     Backbone.js 1.3.2

//     (c) 2010-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self === self && self) ||
            (typeof global == 'object' && global.global === global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch (e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

})(function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  var slice = Array.prototype.slice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.3.2';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Proxy Backbone class methods to Underscore functions, wrapping the model's
  // `attributes` object or collection's `models` array behind the scenes.
  //
  // collection.filter(function(model) { return model.get('age') > 10 });
  // collection.each(this.addView);
  //
  // `Function#apply` can be slow so we use the method's arg count, if we know it.
  var addMethod = function(length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return _[method](this[attribute]);
      };
      case 2: return function(value) {
        return _[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return _[method](this[attribute], cb(iteratee, this), context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return _[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return _[method].apply(_, args);
      };
    }
  };
  var addUnderscoreMethods = function(Class, methods, attribute) {
    _.each(methods, function(length, method) {
      if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
    });
  };

  // Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
  var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };
  var modelMatcher = function(attrs) {
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // a custom event channel. You may bind a callback to an event with `on` or
  // remove with `off`; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // Handle space-separated event names by delegating them individually.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }
    } else {
      // Finally, standard events.
      events = iteratee(events, name, callback, opts);
    }
    return events;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    return internalOn(this, name, callback, context);
  };

  // Guard the `listening` argument from the public API.
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
      context: context,
      ctx: obj,
      listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  Events.listenTo = function(obj, name, callback) {
    if (!obj) return this;
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  Events.off = function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  Events.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    if (typeof name === 'string' && context == null) callback = void 0;
    return this.on(events, callback, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  Events.trigger = function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    var defaults = _.result(this, 'defaults');
    attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    matches: function(attrs) {
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      var unset      = options.unset;
      var silent     = options.silent;
      var changes    = [];
      var changing   = this._changing;
      this._changing = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }

      var current = this.attributes;
      var changed = this.changed;
      var prev    = this._previousAttributes;

      // For each `set` attribute, update or delete the current value.
      for (var attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        } else {
          delete changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Update the `id`.
      if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
      }
      return _.size(changed) ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (!model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !wait) {
        if (!this.set(attrs, options)) return false;
      } else if (!this._validate(attrs, options)) {
        return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      if (this.isNew()) {
        _.defer(options.success);
      } else {
        wrapError(this, options);
        xhr = this.sync('delete', this, options);
      }
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend({}, options, {validate: true}));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model, mapped to the
  // number of arguments they take.
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1};

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  addUnderscoreMethods(Model, modelMethods, 'attributes');

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Splices `insert` into `array` at index `at`.
  var splice = function(array, insert, at) {
    at = Math.min(Math.max(at, 0), array.length);
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
    for (i = 0; i < length; i++) array[i + at] = insert[i];
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
  };

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set. `models` may be Backbone
    // Models or raw JavaScript objects to be converted to Models, or any
    // combination of the two.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      options = _.extend({}, options);
      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();
      var removed = this._removeModels(models, options);
      if (!options.silent && removed.length) {
        options.changes = {added: [], merged: [], removed: removed};
        this.trigger('update', this, options);
      }
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      if (models == null) return;

      options = _.extend({}, setOptions, options);
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || [];
      }

      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();

      var at = options.at;
      if (at != null) at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;

      var set = [];
      var toAdd = [];
      var toMerge = [];
      var toRemove = [];
      var modelMap = {};

      var add = options.add;
      var merge = options.merge;
      var remove = options.remove;

      var sort = false;
      var sortable = this.comparator && at == null && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      var model, i;
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        var existing = this.get(model);
        if (existing) {
          if (merge && model !== existing) {
            var attrs = this._isModel(model) ? model.attributes : model;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            toMerge.push(existing);
            if (sortable && !sort) sort = existing.hasChanged(sortAttr);
          }
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true;
            set.push(existing);
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(model, options);
          if (model) {
            toAdd.push(model);
            this._addReference(model, options);
            modelMap[model.cid] = true;
            set.push(model);
          }
        }
      }

      // Remove stale models.
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      var orderChanged = false;
      var replace = !sortable && add && remove;
      if (set.length && replace) {
        orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
          return m !== set[index];
        });
        this.models.length = 0;
        splice(this.models, set, 0);
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at);
        this.length = this.models.length;
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] ||
        this._byId[this.modelId(obj.attributes || obj)] ||
        obj.cid && this._byId[obj.cid];
    },

    // Returns `true` if the model is in the collection.
    has: function(obj) {
      return this.get(obj) != null;
    },

    // Get the model at the given index.
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      var comparator = this.comparator;
      if (!comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      var length = comparator.length;
      if (_.isFunction(comparator)) comparator = _.bind(comparator, this);

      // Run sort based on type of `comparator`.
      if (length === 1 || _.isString(comparator)) {
        this.models = this.sortBy(comparator);
      } else {
        this.models.sort(comparator);
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(m, resp, callbackOpts) {
        if (wait) collection.add(m, callbackOpts);
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function(attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]);
        if (!model) continue;

        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        // Remove references before triggering 'remove' event to prevent an
        // infinite loop. #3693
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes);
        if (id != null) delete this._byId[id];

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function(model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if (model) {
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        if (event === 'destroy') this.remove(model, options);
        if (event === 'change') {
          var prevId = this.modelId(model.previousAttributes());
          var id = this.modelId(model.attributes);
          if (prevId !== id) {
            if (prevId != null) delete this._byId[prevId];
            if (id != null) this._byId[id] = model;
          }
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
      foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
      contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
      sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};

  // Mix in each Underscore method as a proxy to `Collection#models`.
  addUnderscoreMethods(Collection, collectionMethods, 'models');

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch': 'PATCH',
    'delete': 'DELETE',
    'read': 'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    this.checkUrl = _.bind(this.checkUrl, this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          this.location.replace(rootPath + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function(eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function(eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.some(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      // Strip the hash and decode for matching.
      fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;
});

/*!
 * Bootstrap v3.3.6 (http://getbootstrap.com)
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under the MIT license
 */

if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery')
}

+function ($) {
  'use strict';
  var version = $.fn.jquery.split(' ')[0].split('.')
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1) || (version[0] > 2)) {
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher, but lower than version 3')
  }
}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.3.6
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: alert.js v3.3.6
 * http://getbootstrap.com/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.VERSION = '3.3.6'

  Alert.TRANSITION_DURATION = 150

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = $(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.closest('.alert')
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      // detach from parent, fire event then clean up data
      $parent.detach().trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one('bsTransitionEnd', removeElement)
        .emulateTransitionEnd(Alert.TRANSITION_DURATION) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.alert

  $.fn.alert             = Plugin
  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);

/* ========================================================================
 * Bootstrap: button.js v3.3.6
 * http://getbootstrap.com/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.VERSION  = '3.3.6'

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state += 'Text'

    if (data.resetText == null) $el.data('resetText', $el[val]())

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      $el[val](data[state] == null ? this.options[state] : data[state])

      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked')) changed = false
        $parent.find('.active').removeClass('active')
        this.$element.addClass('active')
      } else if ($input.prop('type') == 'checkbox') {
        if (($input.prop('checked')) !== this.$element.hasClass('active')) changed = false
        this.$element.toggleClass('active')
      }
      $input.prop('checked', this.$element.hasClass('active'))
      if (changed) $input.trigger('change')
    } else {
      this.$element.attr('aria-pressed', !this.$element.hasClass('active'))
      this.$element.toggleClass('active')
    }
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  var old = $.fn.button

  $.fn.button             = Plugin
  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document)
    .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      var $btn = $(e.target)
      if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
      Plugin.call($btn, 'toggle')
      if (!($(e.target).is('input[type="radio"]') || $(e.target).is('input[type="checkbox"]'))) e.preventDefault()
    })
    .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))
    })

}(jQuery);

/* ========================================================================
 * Bootstrap: carousel.js v3.3.6
 * http://getbootstrap.com/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element)
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      = null
    this.sliding     = null
    this.interval    = null
    this.$active     = null
    this.$items      = null

    this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))

    this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
  }

  Carousel.VERSION  = '3.3.6'

  Carousel.TRANSITION_DURATION = 600

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true,
    keyboard: true
  }

  Carousel.prototype.keydown = function (e) {
    if (/input|textarea/i.test(e.target.tagName)) return
    switch (e.which) {
      case 37: this.prev(); break
      case 39: this.next(); break
      default: return
    }

    e.preventDefault()
  }

  Carousel.prototype.cycle = function (e) {
    e || (this.paused = false)

    this.interval && clearInterval(this.interval)

    this.options.interval
      && !this.paused
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))

    return this
  }

  Carousel.prototype.getItemIndex = function (item) {
    this.$items = item.parent().children('.item')
    return this.$items.index(item || this.$active)
  }

  Carousel.prototype.getItemForDirection = function (direction, active) {
    var activeIndex = this.getItemIndex(active)
    var willWrap = (direction == 'prev' && activeIndex === 0)
                || (direction == 'next' && activeIndex == (this.$items.length - 1))
    if (willWrap && !this.options.wrap) return active
    var delta = direction == 'prev' ? -1 : 1
    var itemIndex = (activeIndex + delta) % this.$items.length
    return this.$items.eq(itemIndex)
  }

  Carousel.prototype.to = function (pos) {
    var that        = this
    var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))

    if (pos > (this.$items.length - 1) || pos < 0) return

    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"
    if (activeIndex == pos) return this.pause().cycle()

    return this.slide(pos > activeIndex ? 'next' : 'prev', this.$items.eq(pos))
  }

  Carousel.prototype.pause = function (e) {
    e || (this.paused = true)

    if (this.$element.find('.next, .prev').length && $.support.transition) {
      this.$element.trigger($.support.transition.end)
      this.cycle(true)
    }

    this.interval = clearInterval(this.interval)

    return this
  }

  Carousel.prototype.next = function () {
    if (this.sliding) return
    return this.slide('next')
  }

  Carousel.prototype.prev = function () {
    if (this.sliding) return
    return this.slide('prev')
  }

  Carousel.prototype.slide = function (type, next) {
    var $active   = this.$element.find('.item.active')
    var $next     = next || this.getItemForDirection(type, $active)
    var isCycling = this.interval
    var direction = type == 'next' ? 'left' : 'right'
    var that      = this

    if ($next.hasClass('active')) return (this.sliding = false)

    var relatedTarget = $next[0]
    var slideEvent = $.Event('slide.bs.carousel', {
      relatedTarget: relatedTarget,
      direction: direction
    })
    this.$element.trigger(slideEvent)
    if (slideEvent.isDefaultPrevented()) return

    this.sliding = true

    isCycling && this.pause()

    if (this.$indicators.length) {
      this.$indicators.find('.active').removeClass('active')
      var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])
      $nextIndicator && $nextIndicator.addClass('active')
    }

    var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid"
    if ($.support.transition && this.$element.hasClass('slide')) {
      $next.addClass(type)
      $next[0].offsetWidth // force reflow
      $active.addClass(direction)
      $next.addClass(direction)
      $active
        .one('bsTransitionEnd', function () {
          $next.removeClass([type, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          that.sliding = false
          setTimeout(function () {
            that.$element.trigger(slidEvent)
          }, 0)
        })
        .emulateTransitionEnd(Carousel.TRANSITION_DURATION)
    } else {
      $active.removeClass('active')
      $next.addClass('active')
      this.sliding = false
      this.$element.trigger(slidEvent)
    }

    isCycling && this.cycle()

    return this
  }


  // CAROUSEL PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.carousel')
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var action  = typeof option == 'string' ? option : options.slide

      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
      if (typeof option == 'number') data.to(option)
      else if (action) data[action]()
      else if (options.interval) data.pause().cycle()
    })
  }

  var old = $.fn.carousel

  $.fn.carousel             = Plugin
  $.fn.carousel.Constructor = Carousel


  // CAROUSEL NO CONFLICT
  // ====================

  $.fn.carousel.noConflict = function () {
    $.fn.carousel = old
    return this
  }


  // CAROUSEL DATA-API
  // =================

  var clickHandler = function (e) {
    var href
    var $this   = $(this)
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
    if (!$target.hasClass('carousel')) return
    var options = $.extend({}, $target.data(), $this.data())
    var slideIndex = $this.attr('data-slide-to')
    if (slideIndex) options.interval = false

    Plugin.call($target, options)

    if (slideIndex) {
      $target.data('bs.carousel').to(slideIndex)
    }

    e.preventDefault()
  }

  $(document)
    .on('click.bs.carousel.data-api', '[data-slide]', clickHandler)
    .on('click.bs.carousel.data-api', '[data-slide-to]', clickHandler)

  $(window).on('load', function () {
    $('[data-ride="carousel"]').each(function () {
      var $carousel = $(this)
      Plugin.call($carousel, $carousel.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: collapse.js v3.3.6
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.$trigger      = $('[data-toggle="collapse"][href="#' + element.id + '"],' +
                           '[data-toggle="collapse"][data-target="#' + element.id + '"]')
    this.transitioning = null

    if (this.options.parent) {
      this.$parent = this.getParent()
    } else {
      this.addAriaAndCollapsedClass(this.$element, this.$trigger)
    }

    if (this.options.toggle) this.toggle()
  }

  Collapse.VERSION  = '3.3.6'

  Collapse.TRANSITION_DURATION = 350

  Collapse.DEFAULTS = {
    toggle: true
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var activesData
    var actives = this.$parent && this.$parent.children('.panel').children('.in, .collapsing')

    if (actives && actives.length) {
      activesData = actives.data('bs.collapse')
      if (activesData && activesData.transitioning) return
    }

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    if (actives && actives.length) {
      Plugin.call(actives, 'hide')
      activesData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)
      .attr('aria-expanded', true)

    this.$trigger
      .removeClass('collapsed')
      .attr('aria-expanded', true)

    this.transitioning = 1

    var complete = function () {
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('')
      this.transitioning = 0
      this.$element
        .trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse in')
      .attr('aria-expanded', false)

    this.$trigger
      .addClass('collapsed')
      .attr('aria-expanded', false)

    this.transitioning = 1

    var complete = function () {
      this.transitioning = 0
      this.$element
        .removeClass('collapsing')
        .addClass('collapse')
        .trigger('hidden.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }

  Collapse.prototype.getParent = function () {
    return $(this.options.parent)
      .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')
      .each($.proxy(function (i, element) {
        var $element = $(element)
        this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)
      }, this))
      .end()
  }

  Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {
    var isOpen = $element.hasClass('in')

    $element.attr('aria-expanded', isOpen)
    $trigger
      .toggleClass('collapsed', !isOpen)
      .attr('aria-expanded', isOpen)
  }

  function getTargetFromTrigger($trigger) {
    var href
    var target = $trigger.attr('data-target')
      || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7

    return $(target)
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && /show|hide/.test(option)) options.toggle = false
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.collapse

  $.fn.collapse             = Plugin
  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var $this   = $(this)

    if (!$this.attr('data-target')) e.preventDefault()

    var $target = getTargetFromTrigger($this)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $this.data()

    Plugin.call($target, option)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: dropdown.js v3.3.6
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle="dropdown"]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.VERSION = '3.3.6'

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }

  function clearMenus(e) {
    if (e && e.which === 3) return
    $(backdrop).remove()
    $(toggle).each(function () {
      var $this         = $(this)
      var $parent       = getParent($this)
      var relatedTarget = { relatedTarget: this }

      if (!$parent.hasClass('open')) return

      if (e && e.type == 'click' && /input|textarea/i.test(e.target.tagName) && $.contains($parent[0], e.target)) return

      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this.attr('aria-expanded', 'false')
      $parent.removeClass('open').trigger($.Event('hidden.bs.dropdown', relatedTarget))
    })
  }

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $(document.createElement('div'))
          .addClass('dropdown-backdrop')
          .insertAfter($(this))
          .on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this
        .trigger('focus')
        .attr('aria-expanded', 'true')

      $parent
        .toggleClass('open')
        .trigger($.Event('shown.bs.dropdown', relatedTarget))
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if (!isActive && e.which != 27 || isActive && e.which == 27) {
      if (e.which == 27) $parent.find(toggle).trigger('focus')
      return $this.trigger('click')
    }

    var desc = ' li:not(.disabled):visible a'
    var $items = $parent.find('.dropdown-menu' + desc)

    if (!$items.length) return

    var index = $items.index(e.target)

    if (e.which == 38 && index > 0)                 index--         // up
    if (e.which == 40 && index < $items.length - 1) index++         // down
    if (!~index)                                    index = 0

    $items.eq(index).trigger('focus')
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.dropdown

  $.fn.dropdown             = Plugin
  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle, Dropdown.prototype.keydown)
    .on('keydown.bs.dropdown.data-api', '.dropdown-menu', Dropdown.prototype.keydown)

}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.3.6
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options             = options
    this.$body               = $(document.body)
    this.$element            = $(element)
    this.$dialog             = this.$element.find('.modal-dialog')
    this.$backdrop           = null
    this.isShown             = null
    this.originalBodyPad     = null
    this.scrollbarWidth      = 0
    this.ignoreBackdropClick = false

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.VERSION  = '3.3.6'

  Modal.TRANSITION_DURATION = 300
  Modal.BACKDROP_TRANSITION_DURATION = 150

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.setScrollbar()
    this.$body.addClass('modal-open')

    this.escape()
    this.resize()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.$dialog.on('mousedown.dismiss.bs.modal', function () {
      that.$element.one('mouseup.dismiss.bs.modal', function (e) {
        if ($(e.target).is(that.$element)) that.ignoreBackdropClick = true
      })
    })

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      that.adjustDialog()

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element.addClass('in')

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$dialog // wait for modal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.escape()
    this.resize()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .off('click.dismiss.bs.modal')
      .off('mouseup.dismiss.bs.modal')

    this.$dialog.off('mousedown.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))
        .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.bs.modal')
    }
  }

  Modal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))
    } else {
      $(window).off('resize.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$body.removeClass('modal-open')
      that.resetAdjustments()
      that.resetScrollbar()
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $(document.createElement('div'))
        .addClass('modal-backdrop ' + animate)
        .appendTo(this.$body)

      this.$element.on('click.dismiss.bs.modal', $.proxy(function (e) {
        if (this.ignoreBackdropClick) {
          this.ignoreBackdropClick = false
          return
        }
        if (e.target !== e.currentTarget) return
        this.options.backdrop == 'static'
          ? this.$element[0].focus()
          : this.hide()
      }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  // these following methods are used to handle overflowing modals

  Modal.prototype.handleUpdate = function () {
    this.adjustDialog()
  }

  Modal.prototype.adjustDialog = function () {
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight

    this.$element.css({
      paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
    })
  }

  Modal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    })
  }

  Modal.prototype.checkScrollbar = function () {
    var fullWindowWidth = window.innerWidth
    if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
      var documentElementRect = document.documentElement.getBoundingClientRect()
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left)
    }
    this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth
    this.scrollbarWidth = this.measureScrollbar()
  }

  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    this.originalBodyPad = document.body.style.paddingRight || ''
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', this.originalBodyPad)
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.modal

  $.fn.modal             = Plugin
  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
      $target.one('hidden.bs.modal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tooltip.js v3.3.6
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       = null
    this.options    = null
    this.enabled    = null
    this.timeout    = null
    this.hoverState = null
    this.$element   = null
    this.inState    = null

    this.init('tooltip', element, options)
  }

  Tooltip.VERSION  = '3.3.6'

  Tooltip.TRANSITION_DURATION = 150

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $($.isFunction(this.options.viewport) ? this.options.viewport.call(this, this.$element) : (this.options.viewport.selector || this.options.viewport))
    this.inState   = { click: false, hover: false, focus: false }

    if (this.$element[0] instanceof document.constructor && !this.options.selector) {
      throw new Error('`selector` option must be specified when initializing ' + this.type + ' on the window.document object!')
    }

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    if (obj instanceof $.Event) {
      self.inState[obj.type == 'focusin' ? 'focus' : 'hover'] = true
    }

    if (self.tip().hasClass('in') || self.hoverState == 'in') {
      self.hoverState = 'in'
      return
    }

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.isInStateTrue = function () {
    for (var key in this.inState) {
      if (this.inState[key]) return true
    }

    return false
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    if (obj instanceof $.Event) {
      self.inState[obj.type == 'focusout' ? 'focus' : 'hover'] = false
    }

    if (self.isInStateTrue()) return

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
      if (e.isDefaultPrevented() || !inDom) return
      var that = this

      var $tip = this.tip()

      var tipId = this.getUID(this.type)

      this.setContent()
      $tip.attr('id', tipId)
      this.$element.attr('aria-describedby', tipId)

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)
        .data('bs.' + this.type, this)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)
      this.$element.trigger('inserted.bs.' + this.type)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var viewportDim = this.getPosition(this.$viewport)

        placement = placement == 'bottom' && pos.bottom + actualHeight > viewportDim.bottom ? 'top'    :
                    placement == 'top'    && pos.top    - actualHeight < viewportDim.top    ? 'bottom' :
                    placement == 'right'  && pos.right  + actualWidth  > viewportDim.width  ? 'left'   :
                    placement == 'left'   && pos.left   - actualWidth  < viewportDim.left   ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)

      var complete = function () {
        var prevHoverState = that.hoverState
        that.$element.trigger('shown.bs.' + that.type)
        that.hoverState = null

        if (prevHoverState == 'out') that.leave(that)
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  += marginTop
    offset.left += marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var isVertical          = /top|bottom/.test(placement)
    var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, isVertical) {
    this.arrow()
      .css(isVertical ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
      .css(isVertical ? 'top' : 'left', '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function (callback) {
    var that = this
    var $tip = $(this.$tip)
    var e    = $.Event('hide.bs.' + this.type)

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      that.$element
        .removeAttr('aria-describedby')
        .trigger('hidden.bs.' + that.type)
      callback && callback()
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && $tip.hasClass('fade') ?
      $tip
        .one('bsTransitionEnd', complete)
        .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof $e.attr('data-original-title') != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element

    var el     = $element[0]
    var isBody = el.tagName == 'BODY'

    var elRect    = el.getBoundingClientRect()
    if (elRect.width == null) {
      // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
      elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })
    }
    var elOffset  = isBody ? { top: 0, left: 0 } : $element.offset()
    var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
    var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null

    return $.extend({}, elRect, scroll, outerDims, elOffset)
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.right) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.getUID = function (prefix) {
    do prefix += ~~(Math.random() * 1000000)
    while (document.getElementById(prefix))
    return prefix
  }

  Tooltip.prototype.tip = function () {
    if (!this.$tip) {
      this.$tip = $(this.options.template)
      if (this.$tip.length != 1) {
        throw new Error(this.type + ' `template` option must consist of exactly 1 top-level element!')
      }
    }
    return this.$tip
  }

  Tooltip.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = this
    if (e) {
      self = $(e.currentTarget).data('bs.' + this.type)
      if (!self) {
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())
        $(e.currentTarget).data('bs.' + this.type, self)
      }
    }

    if (e) {
      self.inState.click = !self.inState.click
      if (self.isInStateTrue()) self.enter(self)
      else self.leave(self)
    } else {
      self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
    }
  }

  Tooltip.prototype.destroy = function () {
    var that = this
    clearTimeout(this.timeout)
    this.hide(function () {
      that.$element.off('.' + that.type).removeData('bs.' + that.type)
      if (that.$tip) {
        that.$tip.detach()
      }
      that.$tip = null
      that.$arrow = null
      that.$viewport = null
    })
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && /destroy|hide/.test(option)) return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tooltip

  $.fn.tooltip             = Plugin
  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: popover.js v3.3.6
 * http://getbootstrap.com/javascript/#popovers
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // POPOVER PUBLIC CLASS DEFINITION
  // ===============================

  var Popover = function (element, options) {
    this.init('popover', element, options)
  }

  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')

  Popover.VERSION  = '3.3.6'

  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })


  // NOTE: POPOVER EXTENDS tooltip.js
  // ================================

  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)

  Popover.prototype.constructor = Popover

  Popover.prototype.getDefaults = function () {
    return Popover.DEFAULTS
  }

  Popover.prototype.setContent = function () {
    var $tip    = this.tip()
    var title   = this.getTitle()
    var content = this.getContent()

    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
    $tip.find('.popover-content').children().detach().end()[ // we use append for html objects to maintain js events
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
    ](content)

    $tip.removeClass('fade top bottom left right in')

    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
    // this manually by checking the contents.
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
  }

  Popover.prototype.hasContent = function () {
    return this.getTitle() || this.getContent()
  }

  Popover.prototype.getContent = function () {
    var $e = this.$element
    var o  = this.options

    return $e.attr('data-content')
      || (typeof o.content == 'function' ?
            o.content.call($e[0]) :
            o.content)
  }

  Popover.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.arrow'))
  }


  // POPOVER PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.popover')
      var options = typeof option == 'object' && option

      if (!data && /destroy|hide/.test(option)) return
      if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.popover

  $.fn.popover             = Plugin
  $.fn.popover.Constructor = Popover


  // POPOVER NO CONFLICT
  // ===================

  $.fn.popover.noConflict = function () {
    $.fn.popover = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: scrollspy.js v3.3.6
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    this.$body          = $(document.body)
    this.$scrollElement = $(element).is(document.body) ? $(window) : $(element)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target || '') + ' .nav li > a'
    this.offsets        = []
    this.targets        = []
    this.activeTarget   = null
    this.scrollHeight   = 0

    this.$scrollElement.on('scroll.bs.scrollspy', $.proxy(this.process, this))
    this.refresh()
    this.process()
  }

  ScrollSpy.VERSION  = '3.3.6'

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.getScrollHeight = function () {
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }

  ScrollSpy.prototype.refresh = function () {
    var that          = this
    var offsetMethod  = 'offset'
    var offsetBase    = 0

    this.offsets      = []
    this.targets      = []
    this.scrollHeight = this.getScrollHeight()

    if (!$.isWindow(this.$scrollElement[0])) {
      offsetMethod = 'position'
      offsetBase   = this.$scrollElement.scrollTop()
    }

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        that.offsets.push(this[0])
        that.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.getScrollHeight()
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (this.scrollHeight != scrollHeight) {
      this.refresh()
    }

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
    }

    if (activeTarget && scrollTop < offsets[0]) {
      this.activeTarget = null
      return this.clear()
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (offsets[i + 1] === undefined || scrollTop < offsets[i + 1])
        && this.activate(targets[i])
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    this.clear()

    var selector = this.selector +
      '[data-target="' + target + '"],' +
      this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }

  ScrollSpy.prototype.clear = function () {
    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.scrollspy

  $.fn.scrollspy             = Plugin
  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      Plugin.call($spy, $spy.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tab.js v3.3.6
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    // jscs:disable requireDollarBeforejQueryAssignment
    this.element = $(element)
    // jscs:enable requireDollarBeforejQueryAssignment
  }

  Tab.VERSION = '3.3.6'

  Tab.TRANSITION_DURATION = 150

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var $previous = $ul.find('.active:last a')
    var hideEvent = $.Event('hide.bs.tab', {
      relatedTarget: $this[0]
    })
    var showEvent = $.Event('show.bs.tab', {
      relatedTarget: $previous[0]
    })

    $previous.trigger(hideEvent)
    $this.trigger(showEvent)

    if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.closest('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $previous.trigger({
        type: 'hidden.bs.tab',
        relatedTarget: $this[0]
      })
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: $previous[0]
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && ($active.length && $active.hasClass('fade') || !!container.find('> .fade').length)

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
          .removeClass('active')
        .end()
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', false)

      element
        .addClass('active')
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', true)

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu').length) {
        element
          .closest('li.dropdown')
            .addClass('active')
          .end()
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', true)
      }

      callback && callback()
    }

    $active.length && transition ?
      $active
        .one('bsTransitionEnd', next)
        .emulateTransitionEnd(Tab.TRANSITION_DURATION) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tab

  $.fn.tab             = Plugin
  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  var clickHandler = function (e) {
    e.preventDefault()
    Plugin.call($(this), 'show')
  }

  $(document)
    .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)
    .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)

}(jQuery);

/* ========================================================================
 * Bootstrap: affix.js v3.3.6
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)

    this.$target = $(this.options.target)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      = null
    this.unpin        = null
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.VERSION  = '3.3.6'

  Affix.RESET    = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0,
    target: window
  }

  Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {
    var scrollTop    = this.$target.scrollTop()
    var position     = this.$element.offset()
    var targetHeight = this.$target.height()

    if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false

    if (this.affixed == 'bottom') {
      if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'
      return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'
    }

    var initializing   = this.affixed == null
    var colliderTop    = initializing ? scrollTop : position.top
    var colliderHeight = initializing ? targetHeight : height

    if (offsetTop != null && scrollTop <= offsetTop) return 'top'
    if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'

    return false
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$target.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var height       = this.$element.height()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom
    var scrollHeight = Math.max($(document).height(), $(document.body).height())

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)

    if (this.affixed != affix) {
      if (this.unpin != null) this.$element.css('top', '')

      var affixType = 'affix' + (affix ? '-' + affix : '')
      var e         = $.Event(affixType + '.bs.affix')

      this.$element.trigger(e)

      if (e.isDefaultPrevented()) return

      this.affixed = affix
      this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

      this.$element
        .removeClass(Affix.RESET)
        .addClass(affixType)
        .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')
    }

    if (affix == 'bottom') {
      this.$element.offset({
        top: scrollHeight - height - offsetBottom
      })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.affix

  $.fn.affix             = Plugin
  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom
      if (data.offsetTop    != null) data.offset.top    = data.offsetTop

      Plugin.call($spy, data)
    })
  })

}(jQuery);

/*!
 * Bootstrap v3.3.6 (http://getbootstrap.com)
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under the MIT license
 */
if("undefined"==typeof jQuery)throw new Error("Bootstrap's JavaScript requires jQuery");+function(a){"use strict";var b=a.fn.jquery.split(" ")[0].split(".");if(b[0]<2&&b[1]<9||1==b[0]&&9==b[1]&&b[2]<1||b[0]>2)throw new Error("Bootstrap's JavaScript requires jQuery version 1.9.1 or higher, but lower than version 3")}(jQuery),+function(a){"use strict";function b(){var a=document.createElement("bootstrap"),b={WebkitTransition:"webkitTransitionEnd",MozTransition:"transitionend",OTransition:"oTransitionEnd otransitionend",transition:"transitionend"};for(var c in b)if(void 0!==a.style[c])return{end:b[c]};return!1}a.fn.emulateTransitionEnd=function(b){var c=!1,d=this;a(this).one("bsTransitionEnd",function(){c=!0});var e=function(){c||a(d).trigger(a.support.transition.end)};return setTimeout(e,b),this},a(function(){a.support.transition=b(),a.support.transition&&(a.event.special.bsTransitionEnd={bindType:a.support.transition.end,delegateType:a.support.transition.end,handle:function(b){return a(b.target).is(this)?b.handleObj.handler.apply(this,arguments):void 0}})})}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var c=a(this),e=c.data("bs.alert");e||c.data("bs.alert",e=new d(this)),"string"==typeof b&&e[b].call(c)})}var c='[data-dismiss="alert"]',d=function(b){a(b).on("click",c,this.close)};d.VERSION="3.3.6",d.TRANSITION_DURATION=150,d.prototype.close=function(b){function c(){g.detach().trigger("closed.bs.alert").remove()}var e=a(this),f=e.attr("data-target");f||(f=e.attr("href"),f=f&&f.replace(/.*(?=#[^\s]*$)/,""));var g=a(f);b&&b.preventDefault(),g.length||(g=e.closest(".alert")),g.trigger(b=a.Event("close.bs.alert")),b.isDefaultPrevented()||(g.removeClass("in"),a.support.transition&&g.hasClass("fade")?g.one("bsTransitionEnd",c).emulateTransitionEnd(d.TRANSITION_DURATION):c())};var e=a.fn.alert;a.fn.alert=b,a.fn.alert.Constructor=d,a.fn.alert.noConflict=function(){return a.fn.alert=e,this},a(document).on("click.bs.alert.data-api",c,d.prototype.close)}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.button"),f="object"==typeof b&&b;e||d.data("bs.button",e=new c(this,f)),"toggle"==b?e.toggle():b&&e.setState(b)})}var c=function(b,d){this.$element=a(b),this.options=a.extend({},c.DEFAULTS,d),this.isLoading=!1};c.VERSION="3.3.6",c.DEFAULTS={loadingText:"loading..."},c.prototype.setState=function(b){var c="disabled",d=this.$element,e=d.is("input")?"val":"html",f=d.data();b+="Text",null==f.resetText&&d.data("resetText",d[e]()),setTimeout(a.proxy(function(){d[e](null==f[b]?this.options[b]:f[b]),"loadingText"==b?(this.isLoading=!0,d.addClass(c).attr(c,c)):this.isLoading&&(this.isLoading=!1,d.removeClass(c).removeAttr(c))},this),0)},c.prototype.toggle=function(){var a=!0,b=this.$element.closest('[data-toggle="buttons"]');if(b.length){var c=this.$element.find("input");"radio"==c.prop("type")?(c.prop("checked")&&(a=!1),b.find(".active").removeClass("active"),this.$element.addClass("active")):"checkbox"==c.prop("type")&&(c.prop("checked")!==this.$element.hasClass("active")&&(a=!1),this.$element.toggleClass("active")),c.prop("checked",this.$element.hasClass("active")),a&&c.trigger("change")}else this.$element.attr("aria-pressed",!this.$element.hasClass("active")),this.$element.toggleClass("active")};var d=a.fn.button;a.fn.button=b,a.fn.button.Constructor=c,a.fn.button.noConflict=function(){return a.fn.button=d,this},a(document).on("click.bs.button.data-api",'[data-toggle^="button"]',function(c){var d=a(c.target);d.hasClass("btn")||(d=d.closest(".btn")),b.call(d,"toggle"),a(c.target).is('input[type="radio"]')||a(c.target).is('input[type="checkbox"]')||c.preventDefault()}).on("focus.bs.button.data-api blur.bs.button.data-api",'[data-toggle^="button"]',function(b){a(b.target).closest(".btn").toggleClass("focus",/^focus(in)?$/.test(b.type))})}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.carousel"),f=a.extend({},c.DEFAULTS,d.data(),"object"==typeof b&&b),g="string"==typeof b?b:f.slide;e||d.data("bs.carousel",e=new c(this,f)),"number"==typeof b?e.to(b):g?e[g]():f.interval&&e.pause().cycle()})}var c=function(b,c){this.$element=a(b),this.$indicators=this.$element.find(".carousel-indicators"),this.options=c,this.paused=null,this.sliding=null,this.interval=null,this.$active=null,this.$items=null,this.options.keyboard&&this.$element.on("keydown.bs.carousel",a.proxy(this.keydown,this)),"hover"==this.options.pause&&!("ontouchstart"in document.documentElement)&&this.$element.on("mouseenter.bs.carousel",a.proxy(this.pause,this)).on("mouseleave.bs.carousel",a.proxy(this.cycle,this))};c.VERSION="3.3.6",c.TRANSITION_DURATION=600,c.DEFAULTS={interval:5e3,pause:"hover",wrap:!0,keyboard:!0},c.prototype.keydown=function(a){if(!/input|textarea/i.test(a.target.tagName)){switch(a.which){case 37:this.prev();break;case 39:this.next();break;default:return}a.preventDefault()}},c.prototype.cycle=function(b){return b||(this.paused=!1),this.interval&&clearInterval(this.interval),this.options.interval&&!this.paused&&(this.interval=setInterval(a.proxy(this.next,this),this.options.interval)),this},c.prototype.getItemIndex=function(a){return this.$items=a.parent().children(".item"),this.$items.index(a||this.$active)},c.prototype.getItemForDirection=function(a,b){var c=this.getItemIndex(b),d="prev"==a&&0===c||"next"==a&&c==this.$items.length-1;if(d&&!this.options.wrap)return b;var e="prev"==a?-1:1,f=(c+e)%this.$items.length;return this.$items.eq(f)},c.prototype.to=function(a){var b=this,c=this.getItemIndex(this.$active=this.$element.find(".item.active"));return a>this.$items.length-1||0>a?void 0:this.sliding?this.$element.one("slid.bs.carousel",function(){b.to(a)}):c==a?this.pause().cycle():this.slide(a>c?"next":"prev",this.$items.eq(a))},c.prototype.pause=function(b){return b||(this.paused=!0),this.$element.find(".next, .prev").length&&a.support.transition&&(this.$element.trigger(a.support.transition.end),this.cycle(!0)),this.interval=clearInterval(this.interval),this},c.prototype.next=function(){return this.sliding?void 0:this.slide("next")},c.prototype.prev=function(){return this.sliding?void 0:this.slide("prev")},c.prototype.slide=function(b,d){var e=this.$element.find(".item.active"),f=d||this.getItemForDirection(b,e),g=this.interval,h="next"==b?"left":"right",i=this;if(f.hasClass("active"))return this.sliding=!1;var j=f[0],k=a.Event("slide.bs.carousel",{relatedTarget:j,direction:h});if(this.$element.trigger(k),!k.isDefaultPrevented()){if(this.sliding=!0,g&&this.pause(),this.$indicators.length){this.$indicators.find(".active").removeClass("active");var l=a(this.$indicators.children()[this.getItemIndex(f)]);l&&l.addClass("active")}var m=a.Event("slid.bs.carousel",{relatedTarget:j,direction:h});return a.support.transition&&this.$element.hasClass("slide")?(f.addClass(b),f[0].offsetWidth,e.addClass(h),f.addClass(h),e.one("bsTransitionEnd",function(){f.removeClass([b,h].join(" ")).addClass("active"),e.removeClass(["active",h].join(" ")),i.sliding=!1,setTimeout(function(){i.$element.trigger(m)},0)}).emulateTransitionEnd(c.TRANSITION_DURATION)):(e.removeClass("active"),f.addClass("active"),this.sliding=!1,this.$element.trigger(m)),g&&this.cycle(),this}};var d=a.fn.carousel;a.fn.carousel=b,a.fn.carousel.Constructor=c,a.fn.carousel.noConflict=function(){return a.fn.carousel=d,this};var e=function(c){var d,e=a(this),f=a(e.attr("data-target")||(d=e.attr("href"))&&d.replace(/.*(?=#[^\s]+$)/,""));if(f.hasClass("carousel")){var g=a.extend({},f.data(),e.data()),h=e.attr("data-slide-to");h&&(g.interval=!1),b.call(f,g),h&&f.data("bs.carousel").to(h),c.preventDefault()}};a(document).on("click.bs.carousel.data-api","[data-slide]",e).on("click.bs.carousel.data-api","[data-slide-to]",e),a(window).on("load",function(){a('[data-ride="carousel"]').each(function(){var c=a(this);b.call(c,c.data())})})}(jQuery),+function(a){"use strict";function b(b){var c,d=b.attr("data-target")||(c=b.attr("href"))&&c.replace(/.*(?=#[^\s]+$)/,"");return a(d)}function c(b){return this.each(function(){var c=a(this),e=c.data("bs.collapse"),f=a.extend({},d.DEFAULTS,c.data(),"object"==typeof b&&b);!e&&f.toggle&&/show|hide/.test(b)&&(f.toggle=!1),e||c.data("bs.collapse",e=new d(this,f)),"string"==typeof b&&e[b]()})}var d=function(b,c){this.$element=a(b),this.options=a.extend({},d.DEFAULTS,c),this.$trigger=a('[data-toggle="collapse"][href="#'+b.id+'"],[data-toggle="collapse"][data-target="#'+b.id+'"]'),this.transitioning=null,this.options.parent?this.$parent=this.getParent():this.addAriaAndCollapsedClass(this.$element,this.$trigger),this.options.toggle&&this.toggle()};d.VERSION="3.3.6",d.TRANSITION_DURATION=350,d.DEFAULTS={toggle:!0},d.prototype.dimension=function(){var a=this.$element.hasClass("width");return a?"width":"height"},d.prototype.show=function(){if(!this.transitioning&&!this.$element.hasClass("in")){var b,e=this.$parent&&this.$parent.children(".panel").children(".in, .collapsing");if(!(e&&e.length&&(b=e.data("bs.collapse"),b&&b.transitioning))){var f=a.Event("show.bs.collapse");if(this.$element.trigger(f),!f.isDefaultPrevented()){e&&e.length&&(c.call(e,"hide"),b||e.data("bs.collapse",null));var g=this.dimension();this.$element.removeClass("collapse").addClass("collapsing")[g](0).attr("aria-expanded",!0),this.$trigger.removeClass("collapsed").attr("aria-expanded",!0),this.transitioning=1;var h=function(){this.$element.removeClass("collapsing").addClass("collapse in")[g](""),this.transitioning=0,this.$element.trigger("shown.bs.collapse")};if(!a.support.transition)return h.call(this);var i=a.camelCase(["scroll",g].join("-"));this.$element.one("bsTransitionEnd",a.proxy(h,this)).emulateTransitionEnd(d.TRANSITION_DURATION)[g](this.$element[0][i])}}}},d.prototype.hide=function(){if(!this.transitioning&&this.$element.hasClass("in")){var b=a.Event("hide.bs.collapse");if(this.$element.trigger(b),!b.isDefaultPrevented()){var c=this.dimension();this.$element[c](this.$element[c]())[0].offsetHeight,this.$element.addClass("collapsing").removeClass("collapse in").attr("aria-expanded",!1),this.$trigger.addClass("collapsed").attr("aria-expanded",!1),this.transitioning=1;var e=function(){this.transitioning=0,this.$element.removeClass("collapsing").addClass("collapse").trigger("hidden.bs.collapse")};return a.support.transition?void this.$element[c](0).one("bsTransitionEnd",a.proxy(e,this)).emulateTransitionEnd(d.TRANSITION_DURATION):e.call(this)}}},d.prototype.toggle=function(){this[this.$element.hasClass("in")?"hide":"show"]()},d.prototype.getParent=function(){return a(this.options.parent).find('[data-toggle="collapse"][data-parent="'+this.options.parent+'"]').each(a.proxy(function(c,d){var e=a(d);this.addAriaAndCollapsedClass(b(e),e)},this)).end()},d.prototype.addAriaAndCollapsedClass=function(a,b){var c=a.hasClass("in");a.attr("aria-expanded",c),b.toggleClass("collapsed",!c).attr("aria-expanded",c)};var e=a.fn.collapse;a.fn.collapse=c,a.fn.collapse.Constructor=d,a.fn.collapse.noConflict=function(){return a.fn.collapse=e,this},a(document).on("click.bs.collapse.data-api",'[data-toggle="collapse"]',function(d){var e=a(this);e.attr("data-target")||d.preventDefault();var f=b(e),g=f.data("bs.collapse"),h=g?"toggle":e.data();c.call(f,h)})}(jQuery),+function(a){"use strict";function b(b){var c=b.attr("data-target");c||(c=b.attr("href"),c=c&&/#[A-Za-z]/.test(c)&&c.replace(/.*(?=#[^\s]*$)/,""));var d=c&&a(c);return d&&d.length?d:b.parent()}function c(c){c&&3===c.which||(a(e).remove(),a(f).each(function(){var d=a(this),e=b(d),f={relatedTarget:this};e.hasClass("open")&&(c&&"click"==c.type&&/input|textarea/i.test(c.target.tagName)&&a.contains(e[0],c.target)||(e.trigger(c=a.Event("hide.bs.dropdown",f)),c.isDefaultPrevented()||(d.attr("aria-expanded","false"),e.removeClass("open").trigger(a.Event("hidden.bs.dropdown",f)))))}))}function d(b){return this.each(function(){var c=a(this),d=c.data("bs.dropdown");d||c.data("bs.dropdown",d=new g(this)),"string"==typeof b&&d[b].call(c)})}var e=".dropdown-backdrop",f='[data-toggle="dropdown"]',g=function(b){a(b).on("click.bs.dropdown",this.toggle)};g.VERSION="3.3.6",g.prototype.toggle=function(d){var e=a(this);if(!e.is(".disabled, :disabled")){var f=b(e),g=f.hasClass("open");if(c(),!g){"ontouchstart"in document.documentElement&&!f.closest(".navbar-nav").length&&a(document.createElement("div")).addClass("dropdown-backdrop").insertAfter(a(this)).on("click",c);var h={relatedTarget:this};if(f.trigger(d=a.Event("show.bs.dropdown",h)),d.isDefaultPrevented())return;e.trigger("focus").attr("aria-expanded","true"),f.toggleClass("open").trigger(a.Event("shown.bs.dropdown",h))}return!1}},g.prototype.keydown=function(c){if(/(38|40|27|32)/.test(c.which)&&!/input|textarea/i.test(c.target.tagName)){var d=a(this);if(c.preventDefault(),c.stopPropagation(),!d.is(".disabled, :disabled")){var e=b(d),g=e.hasClass("open");if(!g&&27!=c.which||g&&27==c.which)return 27==c.which&&e.find(f).trigger("focus"),d.trigger("click");var h=" li:not(.disabled):visible a",i=e.find(".dropdown-menu"+h);if(i.length){var j=i.index(c.target);38==c.which&&j>0&&j--,40==c.which&&j<i.length-1&&j++,~j||(j=0),i.eq(j).trigger("focus")}}}};var h=a.fn.dropdown;a.fn.dropdown=d,a.fn.dropdown.Constructor=g,a.fn.dropdown.noConflict=function(){return a.fn.dropdown=h,this},a(document).on("click.bs.dropdown.data-api",c).on("click.bs.dropdown.data-api",".dropdown form",function(a){a.stopPropagation()}).on("click.bs.dropdown.data-api",f,g.prototype.toggle).on("keydown.bs.dropdown.data-api",f,g.prototype.keydown).on("keydown.bs.dropdown.data-api",".dropdown-menu",g.prototype.keydown)}(jQuery),+function(a){"use strict";function b(b,d){return this.each(function(){var e=a(this),f=e.data("bs.modal"),g=a.extend({},c.DEFAULTS,e.data(),"object"==typeof b&&b);f||e.data("bs.modal",f=new c(this,g)),"string"==typeof b?f[b](d):g.show&&f.show(d)})}var c=function(b,c){this.options=c,this.$body=a(document.body),this.$element=a(b),this.$dialog=this.$element.find(".modal-dialog"),this.$backdrop=null,this.isShown=null,this.originalBodyPad=null,this.scrollbarWidth=0,this.ignoreBackdropClick=!1,this.options.remote&&this.$element.find(".modal-content").load(this.options.remote,a.proxy(function(){this.$element.trigger("loaded.bs.modal")},this))};c.VERSION="3.3.6",c.TRANSITION_DURATION=300,c.BACKDROP_TRANSITION_DURATION=150,c.DEFAULTS={backdrop:!0,keyboard:!0,show:!0},c.prototype.toggle=function(a){return this.isShown?this.hide():this.show(a)},c.prototype.show=function(b){var d=this,e=a.Event("show.bs.modal",{relatedTarget:b});this.$element.trigger(e),this.isShown||e.isDefaultPrevented()||(this.isShown=!0,this.checkScrollbar(),this.setScrollbar(),this.$body.addClass("modal-open"),this.escape(),this.resize(),this.$element.on("click.dismiss.bs.modal",'[data-dismiss="modal"]',a.proxy(this.hide,this)),this.$dialog.on("mousedown.dismiss.bs.modal",function(){d.$element.one("mouseup.dismiss.bs.modal",function(b){a(b.target).is(d.$element)&&(d.ignoreBackdropClick=!0)})}),this.backdrop(function(){var e=a.support.transition&&d.$element.hasClass("fade");d.$element.parent().length||d.$element.appendTo(d.$body),d.$element.show().scrollTop(0),d.adjustDialog(),e&&d.$element[0].offsetWidth,d.$element.addClass("in"),d.enforceFocus();var f=a.Event("shown.bs.modal",{relatedTarget:b});e?d.$dialog.one("bsTransitionEnd",function(){d.$element.trigger("focus").trigger(f)}).emulateTransitionEnd(c.TRANSITION_DURATION):d.$element.trigger("focus").trigger(f)}))},c.prototype.hide=function(b){b&&b.preventDefault(),b=a.Event("hide.bs.modal"),this.$element.trigger(b),this.isShown&&!b.isDefaultPrevented()&&(this.isShown=!1,this.escape(),this.resize(),a(document).off("focusin.bs.modal"),this.$element.removeClass("in").off("click.dismiss.bs.modal").off("mouseup.dismiss.bs.modal"),this.$dialog.off("mousedown.dismiss.bs.modal"),a.support.transition&&this.$element.hasClass("fade")?this.$element.one("bsTransitionEnd",a.proxy(this.hideModal,this)).emulateTransitionEnd(c.TRANSITION_DURATION):this.hideModal())},c.prototype.enforceFocus=function(){a(document).off("focusin.bs.modal").on("focusin.bs.modal",a.proxy(function(a){this.$element[0]===a.target||this.$element.has(a.target).length||this.$element.trigger("focus")},this))},c.prototype.escape=function(){this.isShown&&this.options.keyboard?this.$element.on("keydown.dismiss.bs.modal",a.proxy(function(a){27==a.which&&this.hide()},this)):this.isShown||this.$element.off("keydown.dismiss.bs.modal")},c.prototype.resize=function(){this.isShown?a(window).on("resize.bs.modal",a.proxy(this.handleUpdate,this)):a(window).off("resize.bs.modal")},c.prototype.hideModal=function(){var a=this;this.$element.hide(),this.backdrop(function(){a.$body.removeClass("modal-open"),a.resetAdjustments(),a.resetScrollbar(),a.$element.trigger("hidden.bs.modal")})},c.prototype.removeBackdrop=function(){this.$backdrop&&this.$backdrop.remove(),this.$backdrop=null},c.prototype.backdrop=function(b){var d=this,e=this.$element.hasClass("fade")?"fade":"";if(this.isShown&&this.options.backdrop){var f=a.support.transition&&e;if(this.$backdrop=a(document.createElement("div")).addClass("modal-backdrop "+e).appendTo(this.$body),this.$element.on("click.dismiss.bs.modal",a.proxy(function(a){return this.ignoreBackdropClick?void(this.ignoreBackdropClick=!1):void(a.target===a.currentTarget&&("static"==this.options.backdrop?this.$element[0].focus():this.hide()))},this)),f&&this.$backdrop[0].offsetWidth,this.$backdrop.addClass("in"),!b)return;f?this.$backdrop.one("bsTransitionEnd",b).emulateTransitionEnd(c.BACKDROP_TRANSITION_DURATION):b()}else if(!this.isShown&&this.$backdrop){this.$backdrop.removeClass("in");var g=function(){d.removeBackdrop(),b&&b()};a.support.transition&&this.$element.hasClass("fade")?this.$backdrop.one("bsTransitionEnd",g).emulateTransitionEnd(c.BACKDROP_TRANSITION_DURATION):g()}else b&&b()},c.prototype.handleUpdate=function(){this.adjustDialog()},c.prototype.adjustDialog=function(){var a=this.$element[0].scrollHeight>document.documentElement.clientHeight;this.$element.css({paddingLeft:!this.bodyIsOverflowing&&a?this.scrollbarWidth:"",paddingRight:this.bodyIsOverflowing&&!a?this.scrollbarWidth:""})},c.prototype.resetAdjustments=function(){this.$element.css({paddingLeft:"",paddingRight:""})},c.prototype.checkScrollbar=function(){var a=window.innerWidth;if(!a){var b=document.documentElement.getBoundingClientRect();a=b.right-Math.abs(b.left)}this.bodyIsOverflowing=document.body.clientWidth<a,this.scrollbarWidth=this.measureScrollbar()},c.prototype.setScrollbar=function(){var a=parseInt(this.$body.css("padding-right")||0,10);this.originalBodyPad=document.body.style.paddingRight||"",this.bodyIsOverflowing&&this.$body.css("padding-right",a+this.scrollbarWidth)},c.prototype.resetScrollbar=function(){this.$body.css("padding-right",this.originalBodyPad)},c.prototype.measureScrollbar=function(){var a=document.createElement("div");a.className="modal-scrollbar-measure",this.$body.append(a);var b=a.offsetWidth-a.clientWidth;return this.$body[0].removeChild(a),b};var d=a.fn.modal;a.fn.modal=b,a.fn.modal.Constructor=c,a.fn.modal.noConflict=function(){return a.fn.modal=d,this},a(document).on("click.bs.modal.data-api",'[data-toggle="modal"]',function(c){var d=a(this),e=d.attr("href"),f=a(d.attr("data-target")||e&&e.replace(/.*(?=#[^\s]+$)/,"")),g=f.data("bs.modal")?"toggle":a.extend({remote:!/#/.test(e)&&e},f.data(),d.data());d.is("a")&&c.preventDefault(),f.one("show.bs.modal",function(a){a.isDefaultPrevented()||f.one("hidden.bs.modal",function(){d.is(":visible")&&d.trigger("focus")})}),b.call(f,g,this)})}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.tooltip"),f="object"==typeof b&&b;(e||!/destroy|hide/.test(b))&&(e||d.data("bs.tooltip",e=new c(this,f)),"string"==typeof b&&e[b]())})}var c=function(a,b){this.type=null,this.options=null,this.enabled=null,this.timeout=null,this.hoverState=null,this.$element=null,this.inState=null,this.init("tooltip",a,b)};c.VERSION="3.3.6",c.TRANSITION_DURATION=150,c.DEFAULTS={animation:!0,placement:"top",selector:!1,template:'<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',trigger:"hover focus",title:"",delay:0,html:!1,container:!1,viewport:{selector:"body",padding:0}},c.prototype.init=function(b,c,d){if(this.enabled=!0,this.type=b,this.$element=a(c),this.options=this.getOptions(d),this.$viewport=this.options.viewport&&a(a.isFunction(this.options.viewport)?this.options.viewport.call(this,this.$element):this.options.viewport.selector||this.options.viewport),this.inState={click:!1,hover:!1,focus:!1},this.$element[0]instanceof document.constructor&&!this.options.selector)throw new Error("`selector` option must be specified when initializing "+this.type+" on the window.document object!");for(var e=this.options.trigger.split(" "),f=e.length;f--;){var g=e[f];if("click"==g)this.$element.on("click."+this.type,this.options.selector,a.proxy(this.toggle,this));else if("manual"!=g){var h="hover"==g?"mouseenter":"focusin",i="hover"==g?"mouseleave":"focusout";this.$element.on(h+"."+this.type,this.options.selector,a.proxy(this.enter,this)),this.$element.on(i+"."+this.type,this.options.selector,a.proxy(this.leave,this))}}this.options.selector?this._options=a.extend({},this.options,{trigger:"manual",selector:""}):this.fixTitle()},c.prototype.getDefaults=function(){return c.DEFAULTS},c.prototype.getOptions=function(b){return b=a.extend({},this.getDefaults(),this.$element.data(),b),b.delay&&"number"==typeof b.delay&&(b.delay={show:b.delay,hide:b.delay}),b},c.prototype.getDelegateOptions=function(){var b={},c=this.getDefaults();return this._options&&a.each(this._options,function(a,d){c[a]!=d&&(b[a]=d)}),b},c.prototype.enter=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget).data("bs."+this.type);return c||(c=new this.constructor(b.currentTarget,this.getDelegateOptions()),a(b.currentTarget).data("bs."+this.type,c)),b instanceof a.Event&&(c.inState["focusin"==b.type?"focus":"hover"]=!0),c.tip().hasClass("in")||"in"==c.hoverState?void(c.hoverState="in"):(clearTimeout(c.timeout),c.hoverState="in",c.options.delay&&c.options.delay.show?void(c.timeout=setTimeout(function(){"in"==c.hoverState&&c.show()},c.options.delay.show)):c.show())},c.prototype.isInStateTrue=function(){for(var a in this.inState)if(this.inState[a])return!0;return!1},c.prototype.leave=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget).data("bs."+this.type);return c||(c=new this.constructor(b.currentTarget,this.getDelegateOptions()),a(b.currentTarget).data("bs."+this.type,c)),b instanceof a.Event&&(c.inState["focusout"==b.type?"focus":"hover"]=!1),c.isInStateTrue()?void 0:(clearTimeout(c.timeout),c.hoverState="out",c.options.delay&&c.options.delay.hide?void(c.timeout=setTimeout(function(){"out"==c.hoverState&&c.hide()},c.options.delay.hide)):c.hide())},c.prototype.show=function(){var b=a.Event("show.bs."+this.type);if(this.hasContent()&&this.enabled){this.$element.trigger(b);var d=a.contains(this.$element[0].ownerDocument.documentElement,this.$element[0]);if(b.isDefaultPrevented()||!d)return;var e=this,f=this.tip(),g=this.getUID(this.type);this.setContent(),f.attr("id",g),this.$element.attr("aria-describedby",g),this.options.animation&&f.addClass("fade");var h="function"==typeof this.options.placement?this.options.placement.call(this,f[0],this.$element[0]):this.options.placement,i=/\s?auto?\s?/i,j=i.test(h);j&&(h=h.replace(i,"")||"top"),f.detach().css({top:0,left:0,display:"block"}).addClass(h).data("bs."+this.type,this),this.options.container?f.appendTo(this.options.container):f.insertAfter(this.$element),this.$element.trigger("inserted.bs."+this.type);var k=this.getPosition(),l=f[0].offsetWidth,m=f[0].offsetHeight;if(j){var n=h,o=this.getPosition(this.$viewport);h="bottom"==h&&k.bottom+m>o.bottom?"top":"top"==h&&k.top-m<o.top?"bottom":"right"==h&&k.right+l>o.width?"left":"left"==h&&k.left-l<o.left?"right":h,f.removeClass(n).addClass(h)}var p=this.getCalculatedOffset(h,k,l,m);this.applyPlacement(p,h);var q=function(){var a=e.hoverState;e.$element.trigger("shown.bs."+e.type),e.hoverState=null,"out"==a&&e.leave(e)};a.support.transition&&this.$tip.hasClass("fade")?f.one("bsTransitionEnd",q).emulateTransitionEnd(c.TRANSITION_DURATION):q()}},c.prototype.applyPlacement=function(b,c){var d=this.tip(),e=d[0].offsetWidth,f=d[0].offsetHeight,g=parseInt(d.css("margin-top"),10),h=parseInt(d.css("margin-left"),10);isNaN(g)&&(g=0),isNaN(h)&&(h=0),b.top+=g,b.left+=h,a.offset.setOffset(d[0],a.extend({using:function(a){d.css({top:Math.round(a.top),left:Math.round(a.left)})}},b),0),d.addClass("in");var i=d[0].offsetWidth,j=d[0].offsetHeight;"top"==c&&j!=f&&(b.top=b.top+f-j);var k=this.getViewportAdjustedDelta(c,b,i,j);k.left?b.left+=k.left:b.top+=k.top;var l=/top|bottom/.test(c),m=l?2*k.left-e+i:2*k.top-f+j,n=l?"offsetWidth":"offsetHeight";d.offset(b),this.replaceArrow(m,d[0][n],l)},c.prototype.replaceArrow=function(a,b,c){this.arrow().css(c?"left":"top",50*(1-a/b)+"%").css(c?"top":"left","")},c.prototype.setContent=function(){var a=this.tip(),b=this.getTitle();a.find(".tooltip-inner")[this.options.html?"html":"text"](b),a.removeClass("fade in top bottom left right")},c.prototype.hide=function(b){function d(){"in"!=e.hoverState&&f.detach(),e.$element.removeAttr("aria-describedby").trigger("hidden.bs."+e.type),b&&b()}var e=this,f=a(this.$tip),g=a.Event("hide.bs."+this.type);return this.$element.trigger(g),g.isDefaultPrevented()?void 0:(f.removeClass("in"),a.support.transition&&f.hasClass("fade")?f.one("bsTransitionEnd",d).emulateTransitionEnd(c.TRANSITION_DURATION):d(),this.hoverState=null,this)},c.prototype.fixTitle=function(){var a=this.$element;(a.attr("title")||"string"!=typeof a.attr("data-original-title"))&&a.attr("data-original-title",a.attr("title")||"").attr("title","")},c.prototype.hasContent=function(){return this.getTitle()},c.prototype.getPosition=function(b){b=b||this.$element;var c=b[0],d="BODY"==c.tagName,e=c.getBoundingClientRect();null==e.width&&(e=a.extend({},e,{width:e.right-e.left,height:e.bottom-e.top}));var f=d?{top:0,left:0}:b.offset(),g={scroll:d?document.documentElement.scrollTop||document.body.scrollTop:b.scrollTop()},h=d?{width:a(window).width(),height:a(window).height()}:null;return a.extend({},e,g,h,f)},c.prototype.getCalculatedOffset=function(a,b,c,d){return"bottom"==a?{top:b.top+b.height,left:b.left+b.width/2-c/2}:"top"==a?{top:b.top-d,left:b.left+b.width/2-c/2}:"left"==a?{top:b.top+b.height/2-d/2,left:b.left-c}:{top:b.top+b.height/2-d/2,left:b.left+b.width}},c.prototype.getViewportAdjustedDelta=function(a,b,c,d){var e={top:0,left:0};if(!this.$viewport)return e;var f=this.options.viewport&&this.options.viewport.padding||0,g=this.getPosition(this.$viewport);if(/right|left/.test(a)){var h=b.top-f-g.scroll,i=b.top+f-g.scroll+d;h<g.top?e.top=g.top-h:i>g.top+g.height&&(e.top=g.top+g.height-i)}else{var j=b.left-f,k=b.left+f+c;j<g.left?e.left=g.left-j:k>g.right&&(e.left=g.left+g.width-k)}return e},c.prototype.getTitle=function(){var a,b=this.$element,c=this.options;return a=b.attr("data-original-title")||("function"==typeof c.title?c.title.call(b[0]):c.title)},c.prototype.getUID=function(a){do a+=~~(1e6*Math.random());while(document.getElementById(a));return a},c.prototype.tip=function(){if(!this.$tip&&(this.$tip=a(this.options.template),1!=this.$tip.length))throw new Error(this.type+" `template` option must consist of exactly 1 top-level element!");return this.$tip},c.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".tooltip-arrow")},c.prototype.enable=function(){this.enabled=!0},c.prototype.disable=function(){this.enabled=!1},c.prototype.toggleEnabled=function(){this.enabled=!this.enabled},c.prototype.toggle=function(b){var c=this;b&&(c=a(b.currentTarget).data("bs."+this.type),c||(c=new this.constructor(b.currentTarget,this.getDelegateOptions()),a(b.currentTarget).data("bs."+this.type,c))),b?(c.inState.click=!c.inState.click,c.isInStateTrue()?c.enter(c):c.leave(c)):c.tip().hasClass("in")?c.leave(c):c.enter(c)},c.prototype.destroy=function(){var a=this;clearTimeout(this.timeout),this.hide(function(){a.$element.off("."+a.type).removeData("bs."+a.type),a.$tip&&a.$tip.detach(),a.$tip=null,a.$arrow=null,a.$viewport=null})};var d=a.fn.tooltip;a.fn.tooltip=b,a.fn.tooltip.Constructor=c,a.fn.tooltip.noConflict=function(){return a.fn.tooltip=d,this}}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.popover"),f="object"==typeof b&&b;(e||!/destroy|hide/.test(b))&&(e||d.data("bs.popover",e=new c(this,f)),"string"==typeof b&&e[b]())})}var c=function(a,b){this.init("popover",a,b)};if(!a.fn.tooltip)throw new Error("Popover requires tooltip.js");c.VERSION="3.3.6",c.DEFAULTS=a.extend({},a.fn.tooltip.Constructor.DEFAULTS,{placement:"right",trigger:"click",content:"",template:'<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'}),c.prototype=a.extend({},a.fn.tooltip.Constructor.prototype),c.prototype.constructor=c,c.prototype.getDefaults=function(){return c.DEFAULTS},c.prototype.setContent=function(){var a=this.tip(),b=this.getTitle(),c=this.getContent();a.find(".popover-title")[this.options.html?"html":"text"](b),a.find(".popover-content").children().detach().end()[this.options.html?"string"==typeof c?"html":"append":"text"](c),a.removeClass("fade top bottom left right in"),a.find(".popover-title").html()||a.find(".popover-title").hide()},c.prototype.hasContent=function(){return this.getTitle()||this.getContent()},c.prototype.getContent=function(){var a=this.$element,b=this.options;return a.attr("data-content")||("function"==typeof b.content?b.content.call(a[0]):b.content)},c.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".arrow")};var d=a.fn.popover;a.fn.popover=b,a.fn.popover.Constructor=c,a.fn.popover.noConflict=function(){return a.fn.popover=d,this}}(jQuery),+function(a){"use strict";function b(c,d){this.$body=a(document.body),this.$scrollElement=a(a(c).is(document.body)?window:c),this.options=a.extend({},b.DEFAULTS,d),this.selector=(this.options.target||"")+" .nav li > a",this.offsets=[],this.targets=[],this.activeTarget=null,this.scrollHeight=0,this.$scrollElement.on("scroll.bs.scrollspy",a.proxy(this.process,this)),this.refresh(),this.process()}function c(c){return this.each(function(){var d=a(this),e=d.data("bs.scrollspy"),f="object"==typeof c&&c;e||d.data("bs.scrollspy",e=new b(this,f)),"string"==typeof c&&e[c]()})}b.VERSION="3.3.6",b.DEFAULTS={offset:10},b.prototype.getScrollHeight=function(){return this.$scrollElement[0].scrollHeight||Math.max(this.$body[0].scrollHeight,document.documentElement.scrollHeight)},b.prototype.refresh=function(){var b=this,c="offset",d=0;this.offsets=[],this.targets=[],this.scrollHeight=this.getScrollHeight(),a.isWindow(this.$scrollElement[0])||(c="position",d=this.$scrollElement.scrollTop()),this.$body.find(this.selector).map(function(){var b=a(this),e=b.data("target")||b.attr("href"),f=/^#./.test(e)&&a(e);return f&&f.length&&f.is(":visible")&&[[f[c]().top+d,e]]||null}).sort(function(a,b){return a[0]-b[0]}).each(function(){b.offsets.push(this[0]),b.targets.push(this[1])})},b.prototype.process=function(){var a,b=this.$scrollElement.scrollTop()+this.options.offset,c=this.getScrollHeight(),d=this.options.offset+c-this.$scrollElement.height(),e=this.offsets,f=this.targets,g=this.activeTarget;if(this.scrollHeight!=c&&this.refresh(),b>=d)return g!=(a=f[f.length-1])&&this.activate(a);if(g&&b<e[0])return this.activeTarget=null,this.clear();for(a=e.length;a--;)g!=f[a]&&b>=e[a]&&(void 0===e[a+1]||b<e[a+1])&&this.activate(f[a])},b.prototype.activate=function(b){this.activeTarget=b,this.clear();var c=this.selector+'[data-target="'+b+'"],'+this.selector+'[href="'+b+'"]',d=a(c).parents("li").addClass("active");
d.parent(".dropdown-menu").length&&(d=d.closest("li.dropdown").addClass("active")),d.trigger("activate.bs.scrollspy")},b.prototype.clear=function(){a(this.selector).parentsUntil(this.options.target,".active").removeClass("active")};var d=a.fn.scrollspy;a.fn.scrollspy=c,a.fn.scrollspy.Constructor=b,a.fn.scrollspy.noConflict=function(){return a.fn.scrollspy=d,this},a(window).on("load.bs.scrollspy.data-api",function(){a('[data-spy="scroll"]').each(function(){var b=a(this);c.call(b,b.data())})})}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.tab");e||d.data("bs.tab",e=new c(this)),"string"==typeof b&&e[b]()})}var c=function(b){this.element=a(b)};c.VERSION="3.3.6",c.TRANSITION_DURATION=150,c.prototype.show=function(){var b=this.element,c=b.closest("ul:not(.dropdown-menu)"),d=b.data("target");if(d||(d=b.attr("href"),d=d&&d.replace(/.*(?=#[^\s]*$)/,"")),!b.parent("li").hasClass("active")){var e=c.find(".active:last a"),f=a.Event("hide.bs.tab",{relatedTarget:b[0]}),g=a.Event("show.bs.tab",{relatedTarget:e[0]});if(e.trigger(f),b.trigger(g),!g.isDefaultPrevented()&&!f.isDefaultPrevented()){var h=a(d);this.activate(b.closest("li"),c),this.activate(h,h.parent(),function(){e.trigger({type:"hidden.bs.tab",relatedTarget:b[0]}),b.trigger({type:"shown.bs.tab",relatedTarget:e[0]})})}}},c.prototype.activate=function(b,d,e){function f(){g.removeClass("active").find("> .dropdown-menu > .active").removeClass("active").end().find('[data-toggle="tab"]').attr("aria-expanded",!1),b.addClass("active").find('[data-toggle="tab"]').attr("aria-expanded",!0),h?(b[0].offsetWidth,b.addClass("in")):b.removeClass("fade"),b.parent(".dropdown-menu").length&&b.closest("li.dropdown").addClass("active").end().find('[data-toggle="tab"]').attr("aria-expanded",!0),e&&e()}var g=d.find("> .active"),h=e&&a.support.transition&&(g.length&&g.hasClass("fade")||!!d.find("> .fade").length);g.length&&h?g.one("bsTransitionEnd",f).emulateTransitionEnd(c.TRANSITION_DURATION):f(),g.removeClass("in")};var d=a.fn.tab;a.fn.tab=b,a.fn.tab.Constructor=c,a.fn.tab.noConflict=function(){return a.fn.tab=d,this};var e=function(c){c.preventDefault(),b.call(a(this),"show")};a(document).on("click.bs.tab.data-api",'[data-toggle="tab"]',e).on("click.bs.tab.data-api",'[data-toggle="pill"]',e)}(jQuery),+function(a){"use strict";function b(b){return this.each(function(){var d=a(this),e=d.data("bs.affix"),f="object"==typeof b&&b;e||d.data("bs.affix",e=new c(this,f)),"string"==typeof b&&e[b]()})}var c=function(b,d){this.options=a.extend({},c.DEFAULTS,d),this.$target=a(this.options.target).on("scroll.bs.affix.data-api",a.proxy(this.checkPosition,this)).on("click.bs.affix.data-api",a.proxy(this.checkPositionWithEventLoop,this)),this.$element=a(b),this.affixed=null,this.unpin=null,this.pinnedOffset=null,this.checkPosition()};c.VERSION="3.3.6",c.RESET="affix affix-top affix-bottom",c.DEFAULTS={offset:0,target:window},c.prototype.getState=function(a,b,c,d){var e=this.$target.scrollTop(),f=this.$element.offset(),g=this.$target.height();if(null!=c&&"top"==this.affixed)return c>e?"top":!1;if("bottom"==this.affixed)return null!=c?e+this.unpin<=f.top?!1:"bottom":a-d>=e+g?!1:"bottom";var h=null==this.affixed,i=h?e:f.top,j=h?g:b;return null!=c&&c>=e?"top":null!=d&&i+j>=a-d?"bottom":!1},c.prototype.getPinnedOffset=function(){if(this.pinnedOffset)return this.pinnedOffset;this.$element.removeClass(c.RESET).addClass("affix");var a=this.$target.scrollTop(),b=this.$element.offset();return this.pinnedOffset=b.top-a},c.prototype.checkPositionWithEventLoop=function(){setTimeout(a.proxy(this.checkPosition,this),1)},c.prototype.checkPosition=function(){if(this.$element.is(":visible")){var b=this.$element.height(),d=this.options.offset,e=d.top,f=d.bottom,g=Math.max(a(document).height(),a(document.body).height());"object"!=typeof d&&(f=e=d),"function"==typeof e&&(e=d.top(this.$element)),"function"==typeof f&&(f=d.bottom(this.$element));var h=this.getState(g,b,e,f);if(this.affixed!=h){null!=this.unpin&&this.$element.css("top","");var i="affix"+(h?"-"+h:""),j=a.Event(i+".bs.affix");if(this.$element.trigger(j),j.isDefaultPrevented())return;this.affixed=h,this.unpin="bottom"==h?this.getPinnedOffset():null,this.$element.removeClass(c.RESET).addClass(i).trigger(i.replace("affix","affixed")+".bs.affix")}"bottom"==h&&this.$element.offset({top:g-b-f})}};var d=a.fn.affix;a.fn.affix=b,a.fn.affix.Constructor=c,a.fn.affix.noConflict=function(){return a.fn.affix=d,this},a(window).on("load",function(){a('[data-spy="affix"]').each(function(){var c=a(this),d=c.data();d.offset=d.offset||{},null!=d.offsetBottom&&(d.offset.bottom=d.offsetBottom),null!=d.offsetTop&&(d.offset.top=d.offsetTop),b.call(c,d)})})}(jQuery);
/*! @license Firebase v2.4.1
    License: https://www.firebase.com/terms/terms-of-service.html */
(function() {var h,n=this;function p(a){return void 0!==a}function aa(){}function ba(a){a.yb=function(){return a.zf?a.zf:a.zf=new a}}
function ca(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}function da(a){return"array"==ca(a)}function ea(a){var b=ca(a);return"array"==b||"object"==b&&"number"==typeof a.length}function q(a){return"string"==typeof a}function fa(a){return"number"==typeof a}function r(a){return"function"==ca(a)}function ga(a){var b=typeof a;return"object"==b&&null!=a||"function"==b}function ha(a,b,c){return a.call.apply(a.bind,arguments)}
function ia(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function u(a,b,c){u=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ha:ia;return u.apply(null,arguments)}var ja=Date.now||function(){return+new Date};
function ka(a,b){function c(){}c.prototype=b.prototype;a.oh=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.kh=function(a,c,f){for(var g=Array(arguments.length-2),k=2;k<arguments.length;k++)g[k-2]=arguments[k];return b.prototype[c].apply(a,g)}};function la(a){if(Error.captureStackTrace)Error.captureStackTrace(this,la);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))}ka(la,Error);la.prototype.name="CustomError";function v(a,b){for(var c in a)b.call(void 0,a[c],c,a)}function ma(a,b){var c={},d;for(d in a)c[d]=b.call(void 0,a[d],d,a);return c}function na(a,b){for(var c in a)if(!b.call(void 0,a[c],c,a))return!1;return!0}function oa(a){var b=0,c;for(c in a)b++;return b}function pa(a){for(var b in a)return b}function qa(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b}function ra(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b}function sa(a,b){for(var c in a)if(a[c]==b)return!0;return!1}
function ta(a,b,c){for(var d in a)if(b.call(c,a[d],d,a))return d}function ua(a,b){var c=ta(a,b,void 0);return c&&a[c]}function va(a){for(var b in a)return!1;return!0}function wa(a){var b={},c;for(c in a)b[c]=a[c];return b}var xa="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
function ya(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<xa.length;f++)c=xa[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};function za(a){a=String(a);if(/^\s*$/.test(a)?0:/^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g,"@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g,"")))try{return eval("("+a+")")}catch(b){}throw Error("Invalid JSON string: "+a);}function Aa(){this.Vd=void 0}
function Ba(a,b,c){switch(typeof b){case "string":Ca(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?b:"null");break;case "boolean":c.push(b);break;case "undefined":c.push("null");break;case "object":if(null==b){c.push("null");break}if(da(b)){var d=b.length;c.push("[");for(var e="",f=0;f<d;f++)c.push(e),e=b[f],Ba(a,a.Vd?a.Vd.call(b,String(f),e):e,c),e=",";c.push("]");break}c.push("{");d="";for(f in b)Object.prototype.hasOwnProperty.call(b,f)&&(e=b[f],"function"!=typeof e&&(c.push(d),Ca(f,c),
c.push(":"),Ba(a,a.Vd?a.Vd.call(b,f,e):e,c),d=","));c.push("}");break;case "function":break;default:throw Error("Unknown type: "+typeof b);}}var Da={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},Ea=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g;
function Ca(a,b){b.push('"',a.replace(Ea,function(a){if(a in Da)return Da[a];var b=a.charCodeAt(0),e="\\u";16>b?e+="000":256>b?e+="00":4096>b&&(e+="0");return Da[a]=e+b.toString(16)}),'"')};function Fa(){return Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^ja()).toString(36)};var w;a:{var Ga=n.navigator;if(Ga){var Ha=Ga.userAgent;if(Ha){w=Ha;break a}}w=""};function Ia(){this.Ya=-1};function Ja(){this.Ya=-1;this.Ya=64;this.P=[];this.pe=[];this.eg=[];this.Od=[];this.Od[0]=128;for(var a=1;a<this.Ya;++a)this.Od[a]=0;this.ge=this.ec=0;this.reset()}ka(Ja,Ia);Ja.prototype.reset=function(){this.P[0]=1732584193;this.P[1]=4023233417;this.P[2]=2562383102;this.P[3]=271733878;this.P[4]=3285377520;this.ge=this.ec=0};
function Ka(a,b,c){c||(c=0);var d=a.eg;if(q(b))for(var e=0;16>e;e++)d[e]=b.charCodeAt(c)<<24|b.charCodeAt(c+1)<<16|b.charCodeAt(c+2)<<8|b.charCodeAt(c+3),c+=4;else for(e=0;16>e;e++)d[e]=b[c]<<24|b[c+1]<<16|b[c+2]<<8|b[c+3],c+=4;for(e=16;80>e;e++){var f=d[e-3]^d[e-8]^d[e-14]^d[e-16];d[e]=(f<<1|f>>>31)&4294967295}b=a.P[0];c=a.P[1];for(var g=a.P[2],k=a.P[3],m=a.P[4],l,e=0;80>e;e++)40>e?20>e?(f=k^c&(g^k),l=1518500249):(f=c^g^k,l=1859775393):60>e?(f=c&g|k&(c|g),l=2400959708):(f=c^g^k,l=3395469782),f=(b<<
5|b>>>27)+f+m+l+d[e]&4294967295,m=k,k=g,g=(c<<30|c>>>2)&4294967295,c=b,b=f;a.P[0]=a.P[0]+b&4294967295;a.P[1]=a.P[1]+c&4294967295;a.P[2]=a.P[2]+g&4294967295;a.P[3]=a.P[3]+k&4294967295;a.P[4]=a.P[4]+m&4294967295}
Ja.prototype.update=function(a,b){if(null!=a){p(b)||(b=a.length);for(var c=b-this.Ya,d=0,e=this.pe,f=this.ec;d<b;){if(0==f)for(;d<=c;)Ka(this,a,d),d+=this.Ya;if(q(a))for(;d<b;){if(e[f]=a.charCodeAt(d),++f,++d,f==this.Ya){Ka(this,e);f=0;break}}else for(;d<b;)if(e[f]=a[d],++f,++d,f==this.Ya){Ka(this,e);f=0;break}}this.ec=f;this.ge+=b}};var x=Array.prototype,La=x.indexOf?function(a,b,c){return x.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(q(a))return q(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},Ma=x.forEach?function(a,b,c){x.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Na=x.filter?function(a,b,c){return x.filter.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=[],f=0,g=q(a)?
a.split(""):a,k=0;k<d;k++)if(k in g){var m=g[k];b.call(c,m,k,a)&&(e[f++]=m)}return e},Oa=x.map?function(a,b,c){return x.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=q(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},Pa=x.reduce?function(a,b,c,d){for(var e=[],f=1,g=arguments.length;f<g;f++)e.push(arguments[f]);d&&(e[0]=u(b,d));return x.reduce.apply(a,e)}:function(a,b,c,d){var e=c;Ma(a,function(c,g){e=b.call(d,e,c,g,a)});return e},Qa=x.every?function(a,b,
c){return x.every.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&!b.call(c,e[f],f,a))return!1;return!0};function Ra(a,b){var c=Sa(a,b,void 0);return 0>c?null:q(a)?a.charAt(c):a[c]}function Sa(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return f;return-1}function Ta(a,b){var c=La(a,b);0<=c&&x.splice.call(a,c,1)}function Ua(a,b,c){return 2>=arguments.length?x.slice.call(a,b):x.slice.call(a,b,c)}
function Va(a,b){a.sort(b||Wa)}function Wa(a,b){return a>b?1:a<b?-1:0};function Xa(a){n.setTimeout(function(){throw a;},0)}var Ya;
function Za(){var a=n.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&-1==w.indexOf("Presto")&&(a=function(){var a=document.createElement("iframe");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,a=u(function(a){if(("*"==d||a.origin==
d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&-1==w.indexOf("Trident")&&-1==w.indexOf("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(p(c.next)){c=c.next;var a=c.hb;c.hb=null;a()}};return function(a){d.next={hb:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("script")?function(a){var b=
document.createElement("script");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){n.setTimeout(a,0)}};function $a(a,b){ab||bb();cb||(ab(),cb=!0);db.push(new eb(a,b))}var ab;function bb(){if(n.Promise&&n.Promise.resolve){var a=n.Promise.resolve();ab=function(){a.then(fb)}}else ab=function(){var a=fb;!r(n.setImmediate)||n.Window&&n.Window.prototype&&n.Window.prototype.setImmediate==n.setImmediate?(Ya||(Ya=Za()),Ya(a)):n.setImmediate(a)}}var cb=!1,db=[];[].push(function(){cb=!1;db=[]});
function fb(){for(;db.length;){var a=db;db=[];for(var b=0;b<a.length;b++){var c=a[b];try{c.yg.call(c.scope)}catch(d){Xa(d)}}}cb=!1}function eb(a,b){this.yg=a;this.scope=b};var gb=-1!=w.indexOf("Opera")||-1!=w.indexOf("OPR"),hb=-1!=w.indexOf("Trident")||-1!=w.indexOf("MSIE"),ib=-1!=w.indexOf("Gecko")&&-1==w.toLowerCase().indexOf("webkit")&&!(-1!=w.indexOf("Trident")||-1!=w.indexOf("MSIE")),jb=-1!=w.toLowerCase().indexOf("webkit");
(function(){var a="",b;if(gb&&n.opera)return a=n.opera.version,r(a)?a():a;ib?b=/rv\:([^\);]+)(\)|;)/:hb?b=/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/:jb&&(b=/WebKit\/(\S+)/);b&&(a=(a=b.exec(w))?a[1]:"");return hb&&(b=(b=n.document)?b.documentMode:void 0,b>parseFloat(a))?String(b):a})();var kb=null,lb=null,mb=null;function nb(a,b){if(!ea(a))throw Error("encodeByteArray takes an array as a parameter");ob();for(var c=b?lb:kb,d=[],e=0;e<a.length;e+=3){var f=a[e],g=e+1<a.length,k=g?a[e+1]:0,m=e+2<a.length,l=m?a[e+2]:0,t=f>>2,f=(f&3)<<4|k>>4,k=(k&15)<<2|l>>6,l=l&63;m||(l=64,g||(k=64));d.push(c[t],c[f],c[k],c[l])}return d.join("")}
function ob(){if(!kb){kb={};lb={};mb={};for(var a=0;65>a;a++)kb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),lb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a),mb[lb[a]]=a,62<=a&&(mb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a)]=a)}};function pb(a,b){this.N=qb;this.Rf=void 0;this.Ba=this.Ha=null;this.yd=this.ye=!1;if(a==rb)sb(this,tb,b);else try{var c=this;a.call(b,function(a){sb(c,tb,a)},function(a){if(!(a instanceof ub))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}sb(c,vb,a)})}catch(d){sb(this,vb,d)}}var qb=0,tb=2,vb=3;function rb(){}pb.prototype.then=function(a,b,c){return wb(this,r(a)?a:null,r(b)?b:null,c)};pb.prototype.then=pb.prototype.then;pb.prototype.$goog_Thenable=!0;h=pb.prototype;
h.fh=function(a,b){return wb(this,null,a,b)};h.cancel=function(a){this.N==qb&&$a(function(){var b=new ub(a);xb(this,b)},this)};function xb(a,b){if(a.N==qb)if(a.Ha){var c=a.Ha;if(c.Ba){for(var d=0,e=-1,f=0,g;g=c.Ba[f];f++)if(g=g.o)if(d++,g==a&&(e=f),0<=e&&1<d)break;0<=e&&(c.N==qb&&1==d?xb(c,b):(d=c.Ba.splice(e,1)[0],yb(c,d,vb,b)))}a.Ha=null}else sb(a,vb,b)}function zb(a,b){a.Ba&&a.Ba.length||a.N!=tb&&a.N!=vb||Ab(a);a.Ba||(a.Ba=[]);a.Ba.push(b)}
function wb(a,b,c,d){var e={o:null,Hf:null,Jf:null};e.o=new pb(function(a,g){e.Hf=b?function(c){try{var e=b.call(d,c);a(e)}catch(l){g(l)}}:a;e.Jf=c?function(b){try{var e=c.call(d,b);!p(e)&&b instanceof ub?g(b):a(e)}catch(l){g(l)}}:g});e.o.Ha=a;zb(a,e);return e.o}h.Yf=function(a){this.N=qb;sb(this,tb,a)};h.Zf=function(a){this.N=qb;sb(this,vb,a)};
function sb(a,b,c){if(a.N==qb){if(a==c)b=vb,c=new TypeError("Promise cannot resolve to itself");else{var d;if(c)try{d=!!c.$goog_Thenable}catch(e){d=!1}else d=!1;if(d){a.N=1;c.then(a.Yf,a.Zf,a);return}if(ga(c))try{var f=c.then;if(r(f)){Bb(a,c,f);return}}catch(g){b=vb,c=g}}a.Rf=c;a.N=b;a.Ha=null;Ab(a);b!=vb||c instanceof ub||Cb(a,c)}}function Bb(a,b,c){function d(b){f||(f=!0,a.Zf(b))}function e(b){f||(f=!0,a.Yf(b))}a.N=1;var f=!1;try{c.call(b,e,d)}catch(g){d(g)}}
function Ab(a){a.ye||(a.ye=!0,$a(a.wg,a))}h.wg=function(){for(;this.Ba&&this.Ba.length;){var a=this.Ba;this.Ba=null;for(var b=0;b<a.length;b++)yb(this,a[b],this.N,this.Rf)}this.ye=!1};function yb(a,b,c,d){if(c==tb)b.Hf(d);else{if(b.o)for(;a&&a.yd;a=a.Ha)a.yd=!1;b.Jf(d)}}function Cb(a,b){a.yd=!0;$a(function(){a.yd&&Db.call(null,b)})}var Db=Xa;function ub(a){la.call(this,a)}ka(ub,la);ub.prototype.name="cancel";var Eb=Eb||"2.4.1";function y(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function z(a,b){if(Object.prototype.hasOwnProperty.call(a,b))return a[b]}function Fb(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b(c,a[c])}function Gb(a){var b={};Fb(a,function(a,d){b[a]=d});return b}function Hb(a){return"object"===typeof a&&null!==a};function Ib(a){var b=[];Fb(a,function(a,d){da(d)?Ma(d,function(d){b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))}):b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))});return b.length?"&"+b.join("&"):""}function Jb(a){var b={};a=a.replace(/^\?/,"").split("&");Ma(a,function(a){a&&(a=a.split("="),b[a[0]]=a[1])});return b};function Kb(a,b){if(!a)throw Lb(b);}function Lb(a){return Error("Firebase ("+Eb+") INTERNAL ASSERT FAILED: "+a)};var Mb=n.Promise||pb;pb.prototype["catch"]=pb.prototype.fh;function B(){var a=this;this.reject=this.resolve=null;this.D=new Mb(function(b,c){a.resolve=b;a.reject=c})}function C(a,b){return function(c,d){c?a.reject(c):a.resolve(d);r(b)&&(Nb(a.D),1===b.length?b(c):b(c,d))}}function Nb(a){a.then(void 0,aa)};function Ob(a){for(var b=[],c=0,d=0;d<a.length;d++){var e=a.charCodeAt(d);55296<=e&&56319>=e&&(e-=55296,d++,Kb(d<a.length,"Surrogate pair missing trail surrogate."),e=65536+(e<<10)+(a.charCodeAt(d)-56320));128>e?b[c++]=e:(2048>e?b[c++]=e>>6|192:(65536>e?b[c++]=e>>12|224:(b[c++]=e>>18|240,b[c++]=e>>12&63|128),b[c++]=e>>6&63|128),b[c++]=e&63|128)}return b}function Pb(a){for(var b=0,c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b++:2048>d?b+=2:55296<=d&&56319>=d?(b+=4,c++):b+=3}return b};function D(a,b,c,d){var e;d<b?e="at least "+b:d>c&&(e=0===c?"none":"no more than "+c);if(e)throw Error(a+" failed: Was called with "+d+(1===d?" argument.":" arguments.")+" Expects "+e+".");}function E(a,b,c){var d="";switch(b){case 1:d=c?"first":"First";break;case 2:d=c?"second":"Second";break;case 3:d=c?"third":"Third";break;case 4:d=c?"fourth":"Fourth";break;default:throw Error("errorPrefix called with argumentNumber > 4.  Need to update it?");}return a=a+" failed: "+(d+" argument ")}
function F(a,b,c,d){if((!d||p(c))&&!r(c))throw Error(E(a,b,d)+"must be a valid function.");}function Qb(a,b,c){if(p(c)&&(!ga(c)||null===c))throw Error(E(a,b,!0)+"must be a valid context object.");};function Rb(a){return"undefined"!==typeof JSON&&p(JSON.parse)?JSON.parse(a):za(a)}function G(a){if("undefined"!==typeof JSON&&p(JSON.stringify))a=JSON.stringify(a);else{var b=[];Ba(new Aa,a,b);a=b.join("")}return a};function Sb(){this.Zd=H}Sb.prototype.j=function(a){return this.Zd.S(a)};Sb.prototype.toString=function(){return this.Zd.toString()};function Tb(){}Tb.prototype.uf=function(){return null};Tb.prototype.Ce=function(){return null};var Ub=new Tb;function Vb(a,b,c){this.bg=a;this.Oa=b;this.Nd=c}Vb.prototype.uf=function(a){var b=this.Oa.Q;if(Wb(b,a))return b.j().T(a);b=null!=this.Nd?new Xb(this.Nd,!0,!1):this.Oa.w();return this.bg.Bc(a,b)};Vb.prototype.Ce=function(a,b,c){var d=null!=this.Nd?this.Nd:Yb(this.Oa);a=this.bg.qe(d,b,1,c,a);return 0===a.length?null:a[0]};function Zb(){this.xb=[]}function $b(a,b){for(var c=null,d=0;d<b.length;d++){var e=b[d],f=e.cc();null===c||f.ea(c.cc())||(a.xb.push(c),c=null);null===c&&(c=new ac(f));c.add(e)}c&&a.xb.push(c)}function bc(a,b,c){$b(a,c);cc(a,function(a){return a.ea(b)})}function dc(a,b,c){$b(a,c);cc(a,function(a){return a.contains(b)||b.contains(a)})}
function cc(a,b){for(var c=!0,d=0;d<a.xb.length;d++){var e=a.xb[d];if(e)if(e=e.cc(),b(e)){for(var e=a.xb[d],f=0;f<e.xd.length;f++){var g=e.xd[f];if(null!==g){e.xd[f]=null;var k=g.Zb();ec&&fc("event: "+g.toString());gc(k)}}a.xb[d]=null}else c=!1}c&&(a.xb=[])}function ac(a){this.ta=a;this.xd=[]}ac.prototype.add=function(a){this.xd.push(a)};ac.prototype.cc=function(){return this.ta};function J(a,b,c,d){this.type=a;this.Na=b;this.Za=c;this.Oe=d;this.Td=void 0}function hc(a){return new J(ic,a)}var ic="value";function jc(a,b,c,d){this.xe=b;this.be=c;this.Td=d;this.wd=a}jc.prototype.cc=function(){var a=this.be.Mb();return"value"===this.wd?a.path:a.parent().path};jc.prototype.De=function(){return this.wd};jc.prototype.Zb=function(){return this.xe.Zb(this)};jc.prototype.toString=function(){return this.cc().toString()+":"+this.wd+":"+G(this.be.qf())};function kc(a,b,c){this.xe=a;this.error=b;this.path=c}kc.prototype.cc=function(){return this.path};kc.prototype.De=function(){return"cancel"};
kc.prototype.Zb=function(){return this.xe.Zb(this)};kc.prototype.toString=function(){return this.path.toString()+":cancel"};function Xb(a,b,c){this.A=a;this.ga=b;this.Yb=c}function lc(a){return a.ga}function mc(a){return a.Yb}function nc(a,b){return b.e()?a.ga&&!a.Yb:Wb(a,K(b))}function Wb(a,b){return a.ga&&!a.Yb||a.A.Fa(b)}Xb.prototype.j=function(){return this.A};function oc(a){this.pg=a;this.Gd=null}oc.prototype.get=function(){var a=this.pg.get(),b=wa(a);if(this.Gd)for(var c in this.Gd)b[c]-=this.Gd[c];this.Gd=a;return b};function pc(a,b){this.Vf={};this.hd=new oc(a);this.da=b;var c=1E4+2E4*Math.random();setTimeout(u(this.Of,this),Math.floor(c))}pc.prototype.Of=function(){var a=this.hd.get(),b={},c=!1,d;for(d in a)0<a[d]&&y(this.Vf,d)&&(b[d]=a[d],c=!0);c&&this.da.Ye(b);setTimeout(u(this.Of,this),Math.floor(6E5*Math.random()))};function qc(){this.Hc={}}function rc(a,b,c){p(c)||(c=1);y(a.Hc,b)||(a.Hc[b]=0);a.Hc[b]+=c}qc.prototype.get=function(){return wa(this.Hc)};var sc={},tc={};function uc(a){a=a.toString();sc[a]||(sc[a]=new qc);return sc[a]}function vc(a,b){var c=a.toString();tc[c]||(tc[c]=b());return tc[c]};function L(a,b){this.name=a;this.U=b}function wc(a,b){return new L(a,b)};function xc(a,b){return yc(a.name,b.name)}function zc(a,b){return yc(a,b)};function Ac(a,b,c){this.type=Bc;this.source=a;this.path=b;this.Ja=c}Ac.prototype.$c=function(a){return this.path.e()?new Ac(this.source,M,this.Ja.T(a)):new Ac(this.source,N(this.path),this.Ja)};Ac.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" overwrite: "+this.Ja.toString()+")"};function Cc(a,b){this.type=Dc;this.source=a;this.path=b}Cc.prototype.$c=function(){return this.path.e()?new Cc(this.source,M):new Cc(this.source,N(this.path))};Cc.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" listen_complete)"};function Ec(a,b){this.Pa=a;this.xa=b?b:Fc}h=Ec.prototype;h.Sa=function(a,b){return new Ec(this.Pa,this.xa.Sa(a,b,this.Pa).$(null,null,!1,null,null))};h.remove=function(a){return new Ec(this.Pa,this.xa.remove(a,this.Pa).$(null,null,!1,null,null))};h.get=function(a){for(var b,c=this.xa;!c.e();){b=this.Pa(a,c.key);if(0===b)return c.value;0>b?c=c.left:0<b&&(c=c.right)}return null};
function Gc(a,b){for(var c,d=a.xa,e=null;!d.e();){c=a.Pa(b,d.key);if(0===c){if(d.left.e())return e?e.key:null;for(d=d.left;!d.right.e();)d=d.right;return d.key}0>c?d=d.left:0<c&&(e=d,d=d.right)}throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?");}h.e=function(){return this.xa.e()};h.count=function(){return this.xa.count()};h.Vc=function(){return this.xa.Vc()};h.jc=function(){return this.xa.jc()};h.ka=function(a){return this.xa.ka(a)};
h.ac=function(a){return new Hc(this.xa,null,this.Pa,!1,a)};h.bc=function(a,b){return new Hc(this.xa,a,this.Pa,!1,b)};h.dc=function(a,b){return new Hc(this.xa,a,this.Pa,!0,b)};h.xf=function(a){return new Hc(this.xa,null,this.Pa,!0,a)};function Hc(a,b,c,d,e){this.Xd=e||null;this.Je=d;this.Ta=[];for(e=1;!a.e();)if(e=b?c(a.key,b):1,d&&(e*=-1),0>e)a=this.Je?a.left:a.right;else if(0===e){this.Ta.push(a);break}else this.Ta.push(a),a=this.Je?a.right:a.left}
function Ic(a){if(0===a.Ta.length)return null;var b=a.Ta.pop(),c;c=a.Xd?a.Xd(b.key,b.value):{key:b.key,value:b.value};if(a.Je)for(b=b.left;!b.e();)a.Ta.push(b),b=b.right;else for(b=b.right;!b.e();)a.Ta.push(b),b=b.left;return c}function Jc(a){if(0===a.Ta.length)return null;var b;b=a.Ta;b=b[b.length-1];return a.Xd?a.Xd(b.key,b.value):{key:b.key,value:b.value}}function Kc(a,b,c,d,e){this.key=a;this.value=b;this.color=null!=c?c:!0;this.left=null!=d?d:Fc;this.right=null!=e?e:Fc}h=Kc.prototype;
h.$=function(a,b,c,d,e){return new Kc(null!=a?a:this.key,null!=b?b:this.value,null!=c?c:this.color,null!=d?d:this.left,null!=e?e:this.right)};h.count=function(){return this.left.count()+1+this.right.count()};h.e=function(){return!1};h.ka=function(a){return this.left.ka(a)||a(this.key,this.value)||this.right.ka(a)};function Lc(a){return a.left.e()?a:Lc(a.left)}h.Vc=function(){return Lc(this).key};h.jc=function(){return this.right.e()?this.key:this.right.jc()};
h.Sa=function(a,b,c){var d,e;e=this;d=c(a,e.key);e=0>d?e.$(null,null,null,e.left.Sa(a,b,c),null):0===d?e.$(null,b,null,null,null):e.$(null,null,null,null,e.right.Sa(a,b,c));return Mc(e)};function Nc(a){if(a.left.e())return Fc;a.left.ha()||a.left.left.ha()||(a=Oc(a));a=a.$(null,null,null,Nc(a.left),null);return Mc(a)}
h.remove=function(a,b){var c,d;c=this;if(0>b(a,c.key))c.left.e()||c.left.ha()||c.left.left.ha()||(c=Oc(c)),c=c.$(null,null,null,c.left.remove(a,b),null);else{c.left.ha()&&(c=Pc(c));c.right.e()||c.right.ha()||c.right.left.ha()||(c=Qc(c),c.left.left.ha()&&(c=Pc(c),c=Qc(c)));if(0===b(a,c.key)){if(c.right.e())return Fc;d=Lc(c.right);c=c.$(d.key,d.value,null,null,Nc(c.right))}c=c.$(null,null,null,null,c.right.remove(a,b))}return Mc(c)};h.ha=function(){return this.color};
function Mc(a){a.right.ha()&&!a.left.ha()&&(a=Rc(a));a.left.ha()&&a.left.left.ha()&&(a=Pc(a));a.left.ha()&&a.right.ha()&&(a=Qc(a));return a}function Oc(a){a=Qc(a);a.right.left.ha()&&(a=a.$(null,null,null,null,Pc(a.right)),a=Rc(a),a=Qc(a));return a}function Rc(a){return a.right.$(null,null,a.color,a.$(null,null,!0,null,a.right.left),null)}function Pc(a){return a.left.$(null,null,a.color,null,a.$(null,null,!0,a.left.right,null))}
function Qc(a){return a.$(null,null,!a.color,a.left.$(null,null,!a.left.color,null,null),a.right.$(null,null,!a.right.color,null,null))}function Sc(){}h=Sc.prototype;h.$=function(){return this};h.Sa=function(a,b){return new Kc(a,b,null)};h.remove=function(){return this};h.count=function(){return 0};h.e=function(){return!0};h.ka=function(){return!1};h.Vc=function(){return null};h.jc=function(){return null};h.ha=function(){return!1};var Fc=new Sc;function Tc(a,b){return a&&"object"===typeof a?(O(".sv"in a,"Unexpected leaf node or priority contents"),b[a[".sv"]]):a}function Uc(a,b){var c=new Vc;Wc(a,new P(""),function(a,e){c.rc(a,Xc(e,b))});return c}function Xc(a,b){var c=a.C().J(),c=Tc(c,b),d;if(a.L()){var e=Tc(a.Ea(),b);return e!==a.Ea()||c!==a.C().J()?new Yc(e,Q(c)):a}d=a;c!==a.C().J()&&(d=d.ia(new Yc(c)));a.R(R,function(a,c){var e=Xc(c,b);e!==c&&(d=d.W(a,e))});return d};function Zc(){this.Ac={}}Zc.prototype.set=function(a,b){null==b?delete this.Ac[a]:this.Ac[a]=b};Zc.prototype.get=function(a){return y(this.Ac,a)?this.Ac[a]:null};Zc.prototype.remove=function(a){delete this.Ac[a]};Zc.prototype.Af=!0;function $c(a){this.Ic=a;this.Sd="firebase:"}h=$c.prototype;h.set=function(a,b){null==b?this.Ic.removeItem(this.Sd+a):this.Ic.setItem(this.Sd+a,G(b))};h.get=function(a){a=this.Ic.getItem(this.Sd+a);return null==a?null:Rb(a)};h.remove=function(a){this.Ic.removeItem(this.Sd+a)};h.Af=!1;h.toString=function(){return this.Ic.toString()};function ad(a){try{if("undefined"!==typeof window&&"undefined"!==typeof window[a]){var b=window[a];b.setItem("firebase:sentinel","cache");b.removeItem("firebase:sentinel");return new $c(b)}}catch(c){}return new Zc}var bd=ad("localStorage"),cd=ad("sessionStorage");function dd(a,b,c,d,e){this.host=a.toLowerCase();this.domain=this.host.substr(this.host.indexOf(".")+1);this.ob=b;this.lc=c;this.ih=d;this.Rd=e||"";this.ab=bd.get("host:"+a)||this.host}function ed(a,b){b!==a.ab&&(a.ab=b,"s-"===a.ab.substr(0,2)&&bd.set("host:"+a.host,a.ab))}
function fd(a,b,c){O("string"===typeof b,"typeof type must == string");O("object"===typeof c,"typeof params must == object");if(b===gd)b=(a.ob?"wss://":"ws://")+a.ab+"/.ws?";else if(b===hd)b=(a.ob?"https://":"http://")+a.ab+"/.lp?";else throw Error("Unknown connection type: "+b);a.host!==a.ab&&(c.ns=a.lc);var d=[];v(c,function(a,b){d.push(b+"="+a)});return b+d.join("&")}dd.prototype.toString=function(){var a=(this.ob?"https://":"http://")+this.host;this.Rd&&(a+="<"+this.Rd+">");return a};var id=function(){var a=1;return function(){return a++}}(),O=Kb,jd=Lb;
function kd(a){try{var b;if("undefined"!==typeof atob)b=atob(a);else{ob();for(var c=mb,d=[],e=0;e<a.length;){var f=c[a.charAt(e++)],g=e<a.length?c[a.charAt(e)]:0;++e;var k=e<a.length?c[a.charAt(e)]:64;++e;var m=e<a.length?c[a.charAt(e)]:64;++e;if(null==f||null==g||null==k||null==m)throw Error();d.push(f<<2|g>>4);64!=k&&(d.push(g<<4&240|k>>2),64!=m&&d.push(k<<6&192|m))}if(8192>d.length)b=String.fromCharCode.apply(null,d);else{a="";for(c=0;c<d.length;c+=8192)a+=String.fromCharCode.apply(null,Ua(d,c,
c+8192));b=a}}return b}catch(l){fc("base64Decode failed: ",l)}return null}function ld(a){var b=Ob(a);a=new Ja;a.update(b);var b=[],c=8*a.ge;56>a.ec?a.update(a.Od,56-a.ec):a.update(a.Od,a.Ya-(a.ec-56));for(var d=a.Ya-1;56<=d;d--)a.pe[d]=c&255,c/=256;Ka(a,a.pe);for(d=c=0;5>d;d++)for(var e=24;0<=e;e-=8)b[c]=a.P[d]>>e&255,++c;return nb(b)}
function md(a){for(var b="",c=0;c<arguments.length;c++)b=ea(arguments[c])?b+md.apply(null,arguments[c]):"object"===typeof arguments[c]?b+G(arguments[c]):b+arguments[c],b+=" ";return b}var ec=null,nd=!0;
function od(a,b){Kb(!b||!0===a||!1===a,"Can't turn on custom loggers persistently.");!0===a?("undefined"!==typeof console&&("function"===typeof console.log?ec=u(console.log,console):"object"===typeof console.log&&(ec=function(a){console.log(a)})),b&&cd.set("logging_enabled",!0)):r(a)?ec=a:(ec=null,cd.remove("logging_enabled"))}function fc(a){!0===nd&&(nd=!1,null===ec&&!0===cd.get("logging_enabled")&&od(!0));if(ec){var b=md.apply(null,arguments);ec(b)}}
function pd(a){return function(){fc(a,arguments)}}function qd(a){if("undefined"!==typeof console){var b="FIREBASE INTERNAL ERROR: "+md.apply(null,arguments);"undefined"!==typeof console.error?console.error(b):console.log(b)}}function rd(a){var b=md.apply(null,arguments);throw Error("FIREBASE FATAL ERROR: "+b);}function S(a){if("undefined"!==typeof console){var b="FIREBASE WARNING: "+md.apply(null,arguments);"undefined"!==typeof console.warn?console.warn(b):console.log(b)}}
function sd(a){var b="",c="",d="",e="",f=!0,g="https",k=443;if(q(a)){var m=a.indexOf("//");0<=m&&(g=a.substring(0,m-1),a=a.substring(m+2));m=a.indexOf("/");-1===m&&(m=a.length);b=a.substring(0,m);e="";a=a.substring(m).split("/");for(m=0;m<a.length;m++)if(0<a[m].length){var l=a[m];try{l=decodeURIComponent(l.replace(/\+/g," "))}catch(t){}e+="/"+l}a=b.split(".");3===a.length?(c=a[1],d=a[0].toLowerCase()):2===a.length&&(c=a[0]);m=b.indexOf(":");0<=m&&(f="https"===g||"wss"===g,k=b.substring(m+1),isFinite(k)&&
(k=String(k)),k=q(k)?/^\s*-?0x/i.test(k)?parseInt(k,16):parseInt(k,10):NaN)}return{host:b,port:k,domain:c,eh:d,ob:f,scheme:g,bd:e}}function td(a){return fa(a)&&(a!=a||a==Number.POSITIVE_INFINITY||a==Number.NEGATIVE_INFINITY)}
function ud(a){if("complete"===document.readyState)a();else{var b=!1,c=function(){document.body?b||(b=!0,a()):setTimeout(c,Math.floor(10))};document.addEventListener?(document.addEventListener("DOMContentLoaded",c,!1),window.addEventListener("load",c,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",function(){"complete"===document.readyState&&c()}),window.attachEvent("onload",c))}}
function yc(a,b){if(a===b)return 0;if("[MIN_NAME]"===a||"[MAX_NAME]"===b)return-1;if("[MIN_NAME]"===b||"[MAX_NAME]"===a)return 1;var c=vd(a),d=vd(b);return null!==c?null!==d?0==c-d?a.length-b.length:c-d:-1:null!==d?1:a<b?-1:1}function wd(a,b){if(b&&a in b)return b[a];throw Error("Missing required key ("+a+") in object: "+G(b));}
function xd(a){if("object"!==typeof a||null===a)return G(a);var b=[],c;for(c in a)b.push(c);b.sort();c="{";for(var d=0;d<b.length;d++)0!==d&&(c+=","),c+=G(b[d]),c+=":",c+=xd(a[b[d]]);return c+"}"}function yd(a,b){if(a.length<=b)return[a];for(var c=[],d=0;d<a.length;d+=b)d+b>a?c.push(a.substring(d,a.length)):c.push(a.substring(d,d+b));return c}function zd(a,b){if(da(a))for(var c=0;c<a.length;++c)b(c,a[c]);else v(a,b)}
function Ad(a){O(!td(a),"Invalid JSON number");var b,c,d,e;0===a?(d=c=0,b=-Infinity===1/a?1:0):(b=0>a,a=Math.abs(a),a>=Math.pow(2,-1022)?(d=Math.min(Math.floor(Math.log(a)/Math.LN2),1023),c=d+1023,d=Math.round(a*Math.pow(2,52-d)-Math.pow(2,52))):(c=0,d=Math.round(a/Math.pow(2,-1074))));e=[];for(a=52;a;--a)e.push(d%2?1:0),d=Math.floor(d/2);for(a=11;a;--a)e.push(c%2?1:0),c=Math.floor(c/2);e.push(b?1:0);e.reverse();b=e.join("");c="";for(a=0;64>a;a+=8)d=parseInt(b.substr(a,8),2).toString(16),1===d.length&&
(d="0"+d),c+=d;return c.toLowerCase()}var Bd=/^-?\d{1,10}$/;function vd(a){return Bd.test(a)&&(a=Number(a),-2147483648<=a&&2147483647>=a)?a:null}function gc(a){try{a()}catch(b){setTimeout(function(){S("Exception was thrown by user callback.",b.stack||"");throw b;},Math.floor(0))}}function T(a,b){if(r(a)){var c=Array.prototype.slice.call(arguments,1).slice();gc(function(){a.apply(null,c)})}};function Cd(a){var b={},c={},d={},e="";try{var f=a.split("."),b=Rb(kd(f[0])||""),c=Rb(kd(f[1])||""),e=f[2],d=c.d||{};delete c.d}catch(g){}return{lh:b,Ec:c,data:d,ah:e}}function Dd(a){a=Cd(a).Ec;return"object"===typeof a&&a.hasOwnProperty("iat")?z(a,"iat"):null}function Ed(a){a=Cd(a);var b=a.Ec;return!!a.ah&&!!b&&"object"===typeof b&&b.hasOwnProperty("iat")};function Fd(a){this.Y=a;this.g=a.n.g}function Gd(a,b,c,d){var e=[],f=[];Ma(b,function(b){"child_changed"===b.type&&a.g.Dd(b.Oe,b.Na)&&f.push(new J("child_moved",b.Na,b.Za))});Hd(a,e,"child_removed",b,d,c);Hd(a,e,"child_added",b,d,c);Hd(a,e,"child_moved",f,d,c);Hd(a,e,"child_changed",b,d,c);Hd(a,e,ic,b,d,c);return e}function Hd(a,b,c,d,e,f){d=Na(d,function(a){return a.type===c});Va(d,u(a.qg,a));Ma(d,function(c){var d=Id(a,c,f);Ma(e,function(e){e.Qf(c.type)&&b.push(e.createEvent(d,a.Y))})})}
function Id(a,b,c){"value"!==b.type&&"child_removed"!==b.type&&(b.Td=c.wf(b.Za,b.Na,a.g));return b}Fd.prototype.qg=function(a,b){if(null==a.Za||null==b.Za)throw jd("Should only compare child_ events.");return this.g.compare(new L(a.Za,a.Na),new L(b.Za,b.Na))};function Jd(){this.ib={}}
function Kd(a,b){var c=b.type,d=b.Za;O("child_added"==c||"child_changed"==c||"child_removed"==c,"Only child changes supported for tracking");O(".priority"!==d,"Only non-priority child changes can be tracked.");var e=z(a.ib,d);if(e){var f=e.type;if("child_added"==c&&"child_removed"==f)a.ib[d]=new J("child_changed",b.Na,d,e.Na);else if("child_removed"==c&&"child_added"==f)delete a.ib[d];else if("child_removed"==c&&"child_changed"==f)a.ib[d]=new J("child_removed",e.Oe,d);else if("child_changed"==c&&
"child_added"==f)a.ib[d]=new J("child_added",b.Na,d);else if("child_changed"==c&&"child_changed"==f)a.ib[d]=new J("child_changed",b.Na,d,e.Oe);else throw jd("Illegal combination of changes: "+b+" occurred after "+e);}else a.ib[d]=b};function Ld(a){this.g=a}h=Ld.prototype;h.H=function(a,b,c,d,e,f){O(a.Mc(this.g),"A node must be indexed if only a child is updated");e=a.T(b);if(e.S(d).ea(c.S(d))&&e.e()==c.e())return a;null!=f&&(c.e()?a.Fa(b)?Kd(f,new J("child_removed",e,b)):O(a.L(),"A child remove without an old child only makes sense on a leaf node"):e.e()?Kd(f,new J("child_added",c,b)):Kd(f,new J("child_changed",c,b,e)));return a.L()&&c.e()?a:a.W(b,c).pb(this.g)};
h.ya=function(a,b,c){null!=c&&(a.L()||a.R(R,function(a,e){b.Fa(a)||Kd(c,new J("child_removed",e,a))}),b.L()||b.R(R,function(b,e){if(a.Fa(b)){var f=a.T(b);f.ea(e)||Kd(c,new J("child_changed",e,b,f))}else Kd(c,new J("child_added",e,b))}));return b.pb(this.g)};h.ia=function(a,b){return a.e()?H:a.ia(b)};h.Ra=function(){return!1};h.$b=function(){return this};function Md(a){this.Fe=new Ld(a.g);this.g=a.g;var b;a.oa?(b=Nd(a),b=a.g.Sc(Od(a),b)):b=a.g.Wc();this.gd=b;a.ra?(b=Pd(a),a=a.g.Sc(Rd(a),b)):a=a.g.Tc();this.Jc=a}h=Md.prototype;h.matches=function(a){return 0>=this.g.compare(this.gd,a)&&0>=this.g.compare(a,this.Jc)};h.H=function(a,b,c,d,e,f){this.matches(new L(b,c))||(c=H);return this.Fe.H(a,b,c,d,e,f)};
h.ya=function(a,b,c){b.L()&&(b=H);var d=b.pb(this.g),d=d.ia(H),e=this;b.R(R,function(a,b){e.matches(new L(a,b))||(d=d.W(a,H))});return this.Fe.ya(a,d,c)};h.ia=function(a){return a};h.Ra=function(){return!0};h.$b=function(){return this.Fe};function Sd(a){this.ua=new Md(a);this.g=a.g;O(a.la,"Only valid if limit has been set");this.ma=a.ma;this.Nb=!Td(a)}h=Sd.prototype;h.H=function(a,b,c,d,e,f){this.ua.matches(new L(b,c))||(c=H);return a.T(b).ea(c)?a:a.Hb()<this.ma?this.ua.$b().H(a,b,c,d,e,f):Ud(this,a,b,c,e,f)};
h.ya=function(a,b,c){var d;if(b.L()||b.e())d=H.pb(this.g);else if(2*this.ma<b.Hb()&&b.Mc(this.g)){d=H.pb(this.g);b=this.Nb?b.dc(this.ua.Jc,this.g):b.bc(this.ua.gd,this.g);for(var e=0;0<b.Ta.length&&e<this.ma;){var f=Ic(b),g;if(g=this.Nb?0>=this.g.compare(this.ua.gd,f):0>=this.g.compare(f,this.ua.Jc))d=d.W(f.name,f.U),e++;else break}}else{d=b.pb(this.g);d=d.ia(H);var k,m,l;if(this.Nb){b=d.xf(this.g);k=this.ua.Jc;m=this.ua.gd;var t=Vd(this.g);l=function(a,b){return t(b,a)}}else b=d.ac(this.g),k=this.ua.gd,
m=this.ua.Jc,l=Vd(this.g);for(var e=0,A=!1;0<b.Ta.length;)f=Ic(b),!A&&0>=l(k,f)&&(A=!0),(g=A&&e<this.ma&&0>=l(f,m))?e++:d=d.W(f.name,H)}return this.ua.$b().ya(a,d,c)};h.ia=function(a){return a};h.Ra=function(){return!0};h.$b=function(){return this.ua.$b()};
function Ud(a,b,c,d,e,f){var g;if(a.Nb){var k=Vd(a.g);g=function(a,b){return k(b,a)}}else g=Vd(a.g);O(b.Hb()==a.ma,"");var m=new L(c,d),l=a.Nb?Wd(b,a.g):Xd(b,a.g),t=a.ua.matches(m);if(b.Fa(c)){for(var A=b.T(c),l=e.Ce(a.g,l,a.Nb);null!=l&&(l.name==c||b.Fa(l.name));)l=e.Ce(a.g,l,a.Nb);e=null==l?1:g(l,m);if(t&&!d.e()&&0<=e)return null!=f&&Kd(f,new J("child_changed",d,c,A)),b.W(c,d);null!=f&&Kd(f,new J("child_removed",A,c));b=b.W(c,H);return null!=l&&a.ua.matches(l)?(null!=f&&Kd(f,new J("child_added",
l.U,l.name)),b.W(l.name,l.U)):b}return d.e()?b:t&&0<=g(l,m)?(null!=f&&(Kd(f,new J("child_removed",l.U,l.name)),Kd(f,new J("child_added",d,c))),b.W(c,d).W(l.name,H)):b};function Yd(a,b){this.me=a;this.og=b}function Zd(a){this.X=a}
Zd.prototype.gb=function(a,b,c,d){var e=new Jd,f;if(b.type===Bc)b.source.Ae?c=$d(this,a,b.path,b.Ja,c,d,e):(O(b.source.tf,"Unknown source."),f=b.source.ef||mc(a.w())&&!b.path.e(),c=ae(this,a,b.path,b.Ja,c,d,f,e));else if(b.type===be)b.source.Ae?c=ce(this,a,b.path,b.children,c,d,e):(O(b.source.tf,"Unknown source."),f=b.source.ef||mc(a.w()),c=de(this,a,b.path,b.children,c,d,f,e));else if(b.type===ee)if(b.Yd)if(b=b.path,null!=c.xc(b))c=a;else{f=new Vb(c,a,d);d=a.Q.j();if(b.e()||".priority"===K(b))lc(a.w())?
b=c.Aa(Yb(a)):(b=a.w().j(),O(b instanceof fe,"serverChildren would be complete if leaf node"),b=c.Cc(b)),b=this.X.ya(d,b,e);else{var g=K(b),k=c.Bc(g,a.w());null==k&&Wb(a.w(),g)&&(k=d.T(g));b=null!=k?this.X.H(d,g,k,N(b),f,e):a.Q.j().Fa(g)?this.X.H(d,g,H,N(b),f,e):d;b.e()&&lc(a.w())&&(d=c.Aa(Yb(a)),d.L()&&(b=this.X.ya(b,d,e)))}d=lc(a.w())||null!=c.xc(M);c=ge(a,b,d,this.X.Ra())}else c=he(this,a,b.path,b.Ub,c,d,e);else if(b.type===Dc)d=b.path,b=a.w(),f=b.j(),g=b.ga||d.e(),c=ie(this,new je(a.Q,new Xb(f,
g,b.Yb)),d,c,Ub,e);else throw jd("Unknown operation type: "+b.type);e=qa(e.ib);d=c;b=d.Q;b.ga&&(f=b.j().L()||b.j().e(),g=ke(a),(0<e.length||!a.Q.ga||f&&!b.j().ea(g)||!b.j().C().ea(g.C()))&&e.push(hc(ke(d))));return new Yd(c,e)};
function ie(a,b,c,d,e,f){var g=b.Q;if(null!=d.xc(c))return b;var k;if(c.e())O(lc(b.w()),"If change path is empty, we must have complete server data"),mc(b.w())?(e=Yb(b),d=d.Cc(e instanceof fe?e:H)):d=d.Aa(Yb(b)),f=a.X.ya(b.Q.j(),d,f);else{var m=K(c);if(".priority"==m)O(1==le(c),"Can't have a priority with additional path components"),f=g.j(),k=b.w().j(),d=d.nd(c,f,k),f=null!=d?a.X.ia(f,d):g.j();else{var l=N(c);Wb(g,m)?(k=b.w().j(),d=d.nd(c,g.j(),k),d=null!=d?g.j().T(m).H(l,d):g.j().T(m)):d=d.Bc(m,
b.w());f=null!=d?a.X.H(g.j(),m,d,l,e,f):g.j()}}return ge(b,f,g.ga||c.e(),a.X.Ra())}function ae(a,b,c,d,e,f,g,k){var m=b.w();g=g?a.X:a.X.$b();if(c.e())d=g.ya(m.j(),d,null);else if(g.Ra()&&!m.Yb)d=m.j().H(c,d),d=g.ya(m.j(),d,null);else{var l=K(c);if(!nc(m,c)&&1<le(c))return b;var t=N(c);d=m.j().T(l).H(t,d);d=".priority"==l?g.ia(m.j(),d):g.H(m.j(),l,d,t,Ub,null)}m=m.ga||c.e();b=new je(b.Q,new Xb(d,m,g.Ra()));return ie(a,b,c,e,new Vb(e,b,f),k)}
function $d(a,b,c,d,e,f,g){var k=b.Q;e=new Vb(e,b,f);if(c.e())g=a.X.ya(b.Q.j(),d,g),a=ge(b,g,!0,a.X.Ra());else if(f=K(c),".priority"===f)g=a.X.ia(b.Q.j(),d),a=ge(b,g,k.ga,k.Yb);else{c=N(c);var m=k.j().T(f);if(!c.e()){var l=e.uf(f);d=null!=l?".priority"===me(c)&&l.S(c.parent()).e()?l:l.H(c,d):H}m.ea(d)?a=b:(g=a.X.H(k.j(),f,d,c,e,g),a=ge(b,g,k.ga,a.X.Ra()))}return a}
function ce(a,b,c,d,e,f,g){var k=b;ne(d,function(d,l){var t=c.o(d);Wb(b.Q,K(t))&&(k=$d(a,k,t,l,e,f,g))});ne(d,function(d,l){var t=c.o(d);Wb(b.Q,K(t))||(k=$d(a,k,t,l,e,f,g))});return k}function oe(a,b){ne(b,function(b,d){a=a.H(b,d)});return a}
function de(a,b,c,d,e,f,g,k){if(b.w().j().e()&&!lc(b.w()))return b;var m=b;c=c.e()?d:pe(qe,c,d);var l=b.w().j();c.children.ka(function(c,d){if(l.Fa(c)){var I=b.w().j().T(c),I=oe(I,d);m=ae(a,m,new P(c),I,e,f,g,k)}});c.children.ka(function(c,d){var I=!Wb(b.w(),c)&&null==d.value;l.Fa(c)||I||(I=b.w().j().T(c),I=oe(I,d),m=ae(a,m,new P(c),I,e,f,g,k))});return m}
function he(a,b,c,d,e,f,g){if(null!=e.xc(c))return b;var k=mc(b.w()),m=b.w();if(null!=d.value){if(c.e()&&m.ga||nc(m,c))return ae(a,b,c,m.j().S(c),e,f,k,g);if(c.e()){var l=qe;m.j().R(re,function(a,b){l=l.set(new P(a),b)});return de(a,b,c,l,e,f,k,g)}return b}l=qe;ne(d,function(a){var b=c.o(a);nc(m,b)&&(l=l.set(a,m.j().S(b)))});return de(a,b,c,l,e,f,k,g)};function se(){}var te={};function Vd(a){return u(a.compare,a)}se.prototype.Dd=function(a,b){return 0!==this.compare(new L("[MIN_NAME]",a),new L("[MIN_NAME]",b))};se.prototype.Wc=function(){return ue};function ve(a){O(!a.e()&&".priority"!==K(a),"Can't create PathIndex with empty path or .priority key");this.gc=a}ka(ve,se);h=ve.prototype;h.Lc=function(a){return!a.S(this.gc).e()};h.compare=function(a,b){var c=a.U.S(this.gc),d=b.U.S(this.gc),c=c.Gc(d);return 0===c?yc(a.name,b.name):c};
h.Sc=function(a,b){var c=Q(a),c=H.H(this.gc,c);return new L(b,c)};h.Tc=function(){var a=H.H(this.gc,we);return new L("[MAX_NAME]",a)};h.toString=function(){return this.gc.slice().join("/")};function xe(){}ka(xe,se);h=xe.prototype;h.compare=function(a,b){var c=a.U.C(),d=b.U.C(),c=c.Gc(d);return 0===c?yc(a.name,b.name):c};h.Lc=function(a){return!a.C().e()};h.Dd=function(a,b){return!a.C().ea(b.C())};h.Wc=function(){return ue};h.Tc=function(){return new L("[MAX_NAME]",new Yc("[PRIORITY-POST]",we))};
h.Sc=function(a,b){var c=Q(a);return new L(b,new Yc("[PRIORITY-POST]",c))};h.toString=function(){return".priority"};var R=new xe;function ye(){}ka(ye,se);h=ye.prototype;h.compare=function(a,b){return yc(a.name,b.name)};h.Lc=function(){throw jd("KeyIndex.isDefinedOn not expected to be called.");};h.Dd=function(){return!1};h.Wc=function(){return ue};h.Tc=function(){return new L("[MAX_NAME]",H)};h.Sc=function(a){O(q(a),"KeyIndex indexValue must always be a string.");return new L(a,H)};h.toString=function(){return".key"};
var re=new ye;function ze(){}ka(ze,se);h=ze.prototype;h.compare=function(a,b){var c=a.U.Gc(b.U);return 0===c?yc(a.name,b.name):c};h.Lc=function(){return!0};h.Dd=function(a,b){return!a.ea(b)};h.Wc=function(){return ue};h.Tc=function(){return Ae};h.Sc=function(a,b){var c=Q(a);return new L(b,c)};h.toString=function(){return".value"};var Be=new ze;function Ce(){this.Xb=this.ra=this.Pb=this.oa=this.la=!1;this.ma=0;this.Rb="";this.ic=null;this.Bb="";this.fc=null;this.zb="";this.g=R}var De=new Ce;function Td(a){return""===a.Rb?a.oa:"l"===a.Rb}function Od(a){O(a.oa,"Only valid if start has been set");return a.ic}function Nd(a){O(a.oa,"Only valid if start has been set");return a.Pb?a.Bb:"[MIN_NAME]"}function Rd(a){O(a.ra,"Only valid if end has been set");return a.fc}
function Pd(a){O(a.ra,"Only valid if end has been set");return a.Xb?a.zb:"[MAX_NAME]"}function Ee(a){var b=new Ce;b.la=a.la;b.ma=a.ma;b.oa=a.oa;b.ic=a.ic;b.Pb=a.Pb;b.Bb=a.Bb;b.ra=a.ra;b.fc=a.fc;b.Xb=a.Xb;b.zb=a.zb;b.g=a.g;return b}h=Ce.prototype;h.Le=function(a){var b=Ee(this);b.la=!0;b.ma=a;b.Rb="";return b};h.Me=function(a){var b=Ee(this);b.la=!0;b.ma=a;b.Rb="l";return b};h.Ne=function(a){var b=Ee(this);b.la=!0;b.ma=a;b.Rb="r";return b};
h.ce=function(a,b){var c=Ee(this);c.oa=!0;p(a)||(a=null);c.ic=a;null!=b?(c.Pb=!0,c.Bb=b):(c.Pb=!1,c.Bb="");return c};h.vd=function(a,b){var c=Ee(this);c.ra=!0;p(a)||(a=null);c.fc=a;p(b)?(c.Xb=!0,c.zb=b):(c.nh=!1,c.zb="");return c};function Fe(a,b){var c=Ee(a);c.g=b;return c}function Ge(a){var b={};a.oa&&(b.sp=a.ic,a.Pb&&(b.sn=a.Bb));a.ra&&(b.ep=a.fc,a.Xb&&(b.en=a.zb));if(a.la){b.l=a.ma;var c=a.Rb;""===c&&(c=Td(a)?"l":"r");b.vf=c}a.g!==R&&(b.i=a.g.toString());return b}
function He(a){return!(a.oa||a.ra||a.la)}function Ie(a){return He(a)&&a.g==R}function Je(a){var b={};if(Ie(a))return b;var c;a.g===R?c="$priority":a.g===Be?c="$value":a.g===re?c="$key":(O(a.g instanceof ve,"Unrecognized index type!"),c=a.g.toString());b.orderBy=G(c);a.oa&&(b.startAt=G(a.ic),a.Pb&&(b.startAt+=","+G(a.Bb)));a.ra&&(b.endAt=G(a.fc),a.Xb&&(b.endAt+=","+G(a.zb)));a.la&&(Td(a)?b.limitToFirst=a.ma:b.limitToLast=a.ma);return b}h.toString=function(){return G(Ge(this))};function Ke(a,b){this.Ed=a;this.hc=b}Ke.prototype.get=function(a){var b=z(this.Ed,a);if(!b)throw Error("No index defined for "+a);return b===te?null:b};function Le(a,b,c){var d=ma(a.Ed,function(d,f){var g=z(a.hc,f);O(g,"Missing index implementation for "+f);if(d===te){if(g.Lc(b.U)){for(var k=[],m=c.ac(wc),l=Ic(m);l;)l.name!=b.name&&k.push(l),l=Ic(m);k.push(b);return Me(k,Vd(g))}return te}g=c.get(b.name);k=d;g&&(k=k.remove(new L(b.name,g)));return k.Sa(b,b.U)});return new Ke(d,a.hc)}
function Ne(a,b,c){var d=ma(a.Ed,function(a){if(a===te)return a;var d=c.get(b.name);return d?a.remove(new L(b.name,d)):a});return new Ke(d,a.hc)}var Oe=new Ke({".priority":te},{".priority":R});function Yc(a,b){this.B=a;O(p(this.B)&&null!==this.B,"LeafNode shouldn't be created with null/undefined value.");this.ca=b||H;Pe(this.ca);this.Gb=null}var Qe=["object","boolean","number","string"];h=Yc.prototype;h.L=function(){return!0};h.C=function(){return this.ca};h.ia=function(a){return new Yc(this.B,a)};h.T=function(a){return".priority"===a?this.ca:H};h.S=function(a){return a.e()?this:".priority"===K(a)?this.ca:H};h.Fa=function(){return!1};h.wf=function(){return null};
h.W=function(a,b){return".priority"===a?this.ia(b):b.e()&&".priority"!==a?this:H.W(a,b).ia(this.ca)};h.H=function(a,b){var c=K(a);if(null===c)return b;if(b.e()&&".priority"!==c)return this;O(".priority"!==c||1===le(a),".priority must be the last token in a path");return this.W(c,H.H(N(a),b))};h.e=function(){return!1};h.Hb=function(){return 0};h.R=function(){return!1};h.J=function(a){return a&&!this.C().e()?{".value":this.Ea(),".priority":this.C().J()}:this.Ea()};
h.hash=function(){if(null===this.Gb){var a="";this.ca.e()||(a+="priority:"+Re(this.ca.J())+":");var b=typeof this.B,a=a+(b+":"),a="number"===b?a+Ad(this.B):a+this.B;this.Gb=ld(a)}return this.Gb};h.Ea=function(){return this.B};h.Gc=function(a){if(a===H)return 1;if(a instanceof fe)return-1;O(a.L(),"Unknown node type");var b=typeof a.B,c=typeof this.B,d=La(Qe,b),e=La(Qe,c);O(0<=d,"Unknown leaf type: "+b);O(0<=e,"Unknown leaf type: "+c);return d===e?"object"===c?0:this.B<a.B?-1:this.B===a.B?0:1:e-d};
h.pb=function(){return this};h.Mc=function(){return!0};h.ea=function(a){return a===this?!0:a.L()?this.B===a.B&&this.ca.ea(a.ca):!1};h.toString=function(){return G(this.J(!0))};function fe(a,b,c){this.m=a;(this.ca=b)&&Pe(this.ca);a.e()&&O(!this.ca||this.ca.e(),"An empty node cannot have a priority");this.Ab=c;this.Gb=null}h=fe.prototype;h.L=function(){return!1};h.C=function(){return this.ca||H};h.ia=function(a){return this.m.e()?this:new fe(this.m,a,this.Ab)};h.T=function(a){if(".priority"===a)return this.C();a=this.m.get(a);return null===a?H:a};h.S=function(a){var b=K(a);return null===b?this:this.T(b).S(N(a))};h.Fa=function(a){return null!==this.m.get(a)};
h.W=function(a,b){O(b,"We should always be passing snapshot nodes");if(".priority"===a)return this.ia(b);var c=new L(a,b),d,e;b.e()?(d=this.m.remove(a),c=Ne(this.Ab,c,this.m)):(d=this.m.Sa(a,b),c=Le(this.Ab,c,this.m));e=d.e()?H:this.ca;return new fe(d,e,c)};h.H=function(a,b){var c=K(a);if(null===c)return b;O(".priority"!==K(a)||1===le(a),".priority must be the last token in a path");var d=this.T(c).H(N(a),b);return this.W(c,d)};h.e=function(){return this.m.e()};h.Hb=function(){return this.m.count()};
var Se=/^(0|[1-9]\d*)$/;h=fe.prototype;h.J=function(a){if(this.e())return null;var b={},c=0,d=0,e=!0;this.R(R,function(f,g){b[f]=g.J(a);c++;e&&Se.test(f)?d=Math.max(d,Number(f)):e=!1});if(!a&&e&&d<2*c){var f=[],g;for(g in b)f[g]=b[g];return f}a&&!this.C().e()&&(b[".priority"]=this.C().J());return b};h.hash=function(){if(null===this.Gb){var a="";this.C().e()||(a+="priority:"+Re(this.C().J())+":");this.R(R,function(b,c){var d=c.hash();""!==d&&(a+=":"+b+":"+d)});this.Gb=""===a?"":ld(a)}return this.Gb};
h.wf=function(a,b,c){return(c=Te(this,c))?(a=Gc(c,new L(a,b)))?a.name:null:Gc(this.m,a)};function Wd(a,b){var c;c=(c=Te(a,b))?(c=c.Vc())&&c.name:a.m.Vc();return c?new L(c,a.m.get(c)):null}function Xd(a,b){var c;c=(c=Te(a,b))?(c=c.jc())&&c.name:a.m.jc();return c?new L(c,a.m.get(c)):null}h.R=function(a,b){var c=Te(this,a);return c?c.ka(function(a){return b(a.name,a.U)}):this.m.ka(b)};h.ac=function(a){return this.bc(a.Wc(),a)};
h.bc=function(a,b){var c=Te(this,b);if(c)return c.bc(a,function(a){return a});for(var c=this.m.bc(a.name,wc),d=Jc(c);null!=d&&0>b.compare(d,a);)Ic(c),d=Jc(c);return c};h.xf=function(a){return this.dc(a.Tc(),a)};h.dc=function(a,b){var c=Te(this,b);if(c)return c.dc(a,function(a){return a});for(var c=this.m.dc(a.name,wc),d=Jc(c);null!=d&&0<b.compare(d,a);)Ic(c),d=Jc(c);return c};h.Gc=function(a){return this.e()?a.e()?0:-1:a.L()||a.e()?1:a===we?-1:0};
h.pb=function(a){if(a===re||sa(this.Ab.hc,a.toString()))return this;var b=this.Ab,c=this.m;O(a!==re,"KeyIndex always exists and isn't meant to be added to the IndexMap.");for(var d=[],e=!1,c=c.ac(wc),f=Ic(c);f;)e=e||a.Lc(f.U),d.push(f),f=Ic(c);d=e?Me(d,Vd(a)):te;e=a.toString();c=wa(b.hc);c[e]=a;a=wa(b.Ed);a[e]=d;return new fe(this.m,this.ca,new Ke(a,c))};h.Mc=function(a){return a===re||sa(this.Ab.hc,a.toString())};
h.ea=function(a){if(a===this)return!0;if(a.L())return!1;if(this.C().ea(a.C())&&this.m.count()===a.m.count()){var b=this.ac(R);a=a.ac(R);for(var c=Ic(b),d=Ic(a);c&&d;){if(c.name!==d.name||!c.U.ea(d.U))return!1;c=Ic(b);d=Ic(a)}return null===c&&null===d}return!1};function Te(a,b){return b===re?null:a.Ab.get(b.toString())}h.toString=function(){return G(this.J(!0))};function Q(a,b){if(null===a)return H;var c=null;"object"===typeof a&&".priority"in a?c=a[".priority"]:"undefined"!==typeof b&&(c=b);O(null===c||"string"===typeof c||"number"===typeof c||"object"===typeof c&&".sv"in c,"Invalid priority type found: "+typeof c);"object"===typeof a&&".value"in a&&null!==a[".value"]&&(a=a[".value"]);if("object"!==typeof a||".sv"in a)return new Yc(a,Q(c));if(a instanceof Array){var d=H,e=a;v(e,function(a,b){if(y(e,b)&&"."!==b.substring(0,1)){var c=Q(a);if(c.L()||!c.e())d=
d.W(b,c)}});return d.ia(Q(c))}var f=[],g=!1,k=a;Fb(k,function(a){if("string"!==typeof a||"."!==a.substring(0,1)){var b=Q(k[a]);b.e()||(g=g||!b.C().e(),f.push(new L(a,b)))}});if(0==f.length)return H;var m=Me(f,xc,function(a){return a.name},zc);if(g){var l=Me(f,Vd(R));return new fe(m,Q(c),new Ke({".priority":l},{".priority":R}))}return new fe(m,Q(c),Oe)}var Ue=Math.log(2);
function Ve(a){this.count=parseInt(Math.log(a+1)/Ue,10);this.nf=this.count-1;this.ng=a+1&parseInt(Array(this.count+1).join("1"),2)}function We(a){var b=!(a.ng&1<<a.nf);a.nf--;return b}
function Me(a,b,c,d){function e(b,d){var f=d-b;if(0==f)return null;if(1==f){var l=a[b],t=c?c(l):l;return new Kc(t,l.U,!1,null,null)}var l=parseInt(f/2,10)+b,f=e(b,l),A=e(l+1,d),l=a[l],t=c?c(l):l;return new Kc(t,l.U,!1,f,A)}a.sort(b);var f=function(b){function d(b,g){var k=t-b,A=t;t-=b;var A=e(k+1,A),k=a[k],I=c?c(k):k,A=new Kc(I,k.U,g,null,A);f?f.left=A:l=A;f=A}for(var f=null,l=null,t=a.length,A=0;A<b.count;++A){var I=We(b),Qd=Math.pow(2,b.count-(A+1));I?d(Qd,!1):(d(Qd,!1),d(Qd,!0))}return l}(new Ve(a.length));
return null!==f?new Ec(d||b,f):new Ec(d||b)}function Re(a){return"number"===typeof a?"number:"+Ad(a):"string:"+a}function Pe(a){if(a.L()){var b=a.J();O("string"===typeof b||"number"===typeof b||"object"===typeof b&&y(b,".sv"),"Priority must be a string or number.")}else O(a===we||a.e(),"priority of unexpected type.");O(a===we||a.C().e(),"Priority nodes can't have a priority of their own.")}var H=new fe(new Ec(zc),null,Oe);function Xe(){fe.call(this,new Ec(zc),H,Oe)}ka(Xe,fe);h=Xe.prototype;
h.Gc=function(a){return a===this?0:1};h.ea=function(a){return a===this};h.C=function(){return this};h.T=function(){return H};h.e=function(){return!1};var we=new Xe,ue=new L("[MIN_NAME]",H),Ae=new L("[MAX_NAME]",we);function je(a,b){this.Q=a;this.ae=b}function ge(a,b,c,d){return new je(new Xb(b,c,d),a.ae)}function ke(a){return a.Q.ga?a.Q.j():null}je.prototype.w=function(){return this.ae};function Yb(a){return a.ae.ga?a.ae.j():null};function Ye(a,b){this.Y=a;var c=a.n,d=new Ld(c.g),c=He(c)?new Ld(c.g):c.la?new Sd(c):new Md(c);this.Nf=new Zd(c);var e=b.w(),f=b.Q,g=d.ya(H,e.j(),null),k=c.ya(H,f.j(),null);this.Oa=new je(new Xb(k,f.ga,c.Ra()),new Xb(g,e.ga,d.Ra()));this.$a=[];this.ug=new Fd(a)}function Ze(a){return a.Y}h=Ye.prototype;h.w=function(){return this.Oa.w().j()};h.kb=function(a){var b=Yb(this.Oa);return b&&(He(this.Y.n)||!a.e()&&!b.T(K(a)).e())?b.S(a):null};h.e=function(){return 0===this.$a.length};h.Tb=function(a){this.$a.push(a)};
h.nb=function(a,b){var c=[];if(b){O(null==a,"A cancel should cancel all event registrations.");var d=this.Y.path;Ma(this.$a,function(a){(a=a.lf(b,d))&&c.push(a)})}if(a){for(var e=[],f=0;f<this.$a.length;++f){var g=this.$a[f];if(!g.matches(a))e.push(g);else if(a.yf()){e=e.concat(this.$a.slice(f+1));break}}this.$a=e}else this.$a=[];return c};
h.gb=function(a,b,c){a.type===be&&null!==a.source.Lb&&(O(Yb(this.Oa),"We should always have a full cache before handling merges"),O(ke(this.Oa),"Missing event cache, even though we have a server cache"));var d=this.Oa;a=this.Nf.gb(d,a,b,c);b=this.Nf;c=a.me;O(c.Q.j().Mc(b.X.g),"Event snap not indexed");O(c.w().j().Mc(b.X.g),"Server snap not indexed");O(lc(a.me.w())||!lc(d.w()),"Once a server snap is complete, it should never go back");this.Oa=a.me;return $e(this,a.og,a.me.Q.j(),null)};
function af(a,b){var c=a.Oa.Q,d=[];c.j().L()||c.j().R(R,function(a,b){d.push(new J("child_added",b,a))});c.ga&&d.push(hc(c.j()));return $e(a,d,c.j(),b)}function $e(a,b,c,d){return Gd(a.ug,b,c,d?[d]:a.$a)};function bf(a,b,c){this.type=be;this.source=a;this.path=b;this.children=c}bf.prototype.$c=function(a){if(this.path.e())return a=this.children.subtree(new P(a)),a.e()?null:a.value?new Ac(this.source,M,a.value):new bf(this.source,M,a);O(K(this.path)===a,"Can't get a merge for a child not on the path of the operation");return new bf(this.source,N(this.path),this.children)};bf.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" merge: "+this.children.toString()+")"};function cf(a,b){this.f=pd("p:rest:");this.G=a;this.Kb=b;this.Ca=null;this.ba={}}function df(a,b){if(p(b))return"tag$"+b;O(Ie(a.n),"should have a tag if it's not a default query.");return a.path.toString()}h=cf.prototype;
h.Cf=function(a,b,c,d){var e=a.path.toString();this.f("Listen called for "+e+" "+a.wa());var f=df(a,c),g={};this.ba[f]=g;a=Je(a.n);var k=this;ef(this,e+".json",a,function(a,b){var t=b;404===a&&(a=t=null);null===a&&k.Kb(e,t,!1,c);z(k.ba,f)===g&&d(a?401==a?"permission_denied":"rest_error:"+a:"ok",null)})};h.$f=function(a,b){var c=df(a,b);delete this.ba[c]};h.O=function(a,b){this.Ca=a;var c=Cd(a),d=c.data,c=c.Ec&&c.Ec.exp;b&&b("ok",{auth:d,expires:c})};h.je=function(a){this.Ca=null;a("ok",null)};
h.Qe=function(){};h.Gf=function(){};h.Md=function(){};h.put=function(){};h.Df=function(){};h.Ye=function(){};
function ef(a,b,c,d){c=c||{};c.format="export";a.Ca&&(c.auth=a.Ca);var e=(a.G.ob?"https://":"http://")+a.G.host+b+"?"+Ib(c);a.f("Sending REST request for "+e);var f=new XMLHttpRequest;f.onreadystatechange=function(){if(d&&4===f.readyState){a.f("REST Response for "+e+" received. status:",f.status,"response:",f.responseText);var b=null;if(200<=f.status&&300>f.status){try{b=Rb(f.responseText)}catch(c){S("Failed to parse JSON response for "+e+": "+f.responseText)}d(null,b)}else 401!==f.status&&404!==
f.status&&S("Got unsuccessful REST response for "+e+" Status: "+f.status),d(f.status);d=null}};f.open("GET",e,!0);f.send()};function ff(a){O(da(a)&&0<a.length,"Requires a non-empty array");this.fg=a;this.Rc={}}ff.prototype.ie=function(a,b){var c;c=this.Rc[a]||[];var d=c.length;if(0<d){for(var e=Array(d),f=0;f<d;f++)e[f]=c[f];c=e}else c=[];for(d=0;d<c.length;d++)c[d].Dc.apply(c[d].Qa,Array.prototype.slice.call(arguments,1))};ff.prototype.Ib=function(a,b,c){gf(this,a);this.Rc[a]=this.Rc[a]||[];this.Rc[a].push({Dc:b,Qa:c});(a=this.Ee(a))&&b.apply(c,a)};
ff.prototype.mc=function(a,b,c){gf(this,a);a=this.Rc[a]||[];for(var d=0;d<a.length;d++)if(a[d].Dc===b&&(!c||c===a[d].Qa)){a.splice(d,1);break}};function gf(a,b){O(Ra(a.fg,function(a){return a===b}),"Unknown event: "+b)};var hf=function(){var a=0,b=[];return function(c){var d=c===a;a=c;for(var e=Array(8),f=7;0<=f;f--)e[f]="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c%64),c=Math.floor(c/64);O(0===c,"Cannot push at time == 0");c=e.join("");if(d){for(f=11;0<=f&&63===b[f];f--)b[f]=0;b[f]++}else for(f=0;12>f;f++)b[f]=Math.floor(64*Math.random());for(f=0;12>f;f++)c+="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);O(20===c.length,"nextPushId: Length should be 20.");
return c}}();function jf(){ff.call(this,["online"]);this.oc=!0;if("undefined"!==typeof window&&"undefined"!==typeof window.addEventListener){var a=this;window.addEventListener("online",function(){a.oc||(a.oc=!0,a.ie("online",!0))},!1);window.addEventListener("offline",function(){a.oc&&(a.oc=!1,a.ie("online",!1))},!1)}}ka(jf,ff);jf.prototype.Ee=function(a){O("online"===a,"Unknown event type: "+a);return[this.oc]};ba(jf);function kf(){ff.call(this,["visible"]);var a,b;"undefined"!==typeof document&&"undefined"!==typeof document.addEventListener&&("undefined"!==typeof document.hidden?(b="visibilitychange",a="hidden"):"undefined"!==typeof document.mozHidden?(b="mozvisibilitychange",a="mozHidden"):"undefined"!==typeof document.msHidden?(b="msvisibilitychange",a="msHidden"):"undefined"!==typeof document.webkitHidden&&(b="webkitvisibilitychange",a="webkitHidden"));this.Sb=!0;if(b){var c=this;document.addEventListener(b,
function(){var b=!document[a];b!==c.Sb&&(c.Sb=b,c.ie("visible",b))},!1)}}ka(kf,ff);kf.prototype.Ee=function(a){O("visible"===a,"Unknown event type: "+a);return[this.Sb]};ba(kf);function P(a,b){if(1==arguments.length){this.u=a.split("/");for(var c=0,d=0;d<this.u.length;d++)0<this.u[d].length&&(this.u[c]=this.u[d],c++);this.u.length=c;this.aa=0}else this.u=a,this.aa=b}function lf(a,b){var c=K(a);if(null===c)return b;if(c===K(b))return lf(N(a),N(b));throw Error("INTERNAL ERROR: innerPath ("+b+") is not within outerPath ("+a+")");}
function mf(a,b){for(var c=a.slice(),d=b.slice(),e=0;e<c.length&&e<d.length;e++){var f=yc(c[e],d[e]);if(0!==f)return f}return c.length===d.length?0:c.length<d.length?-1:1}function K(a){return a.aa>=a.u.length?null:a.u[a.aa]}function le(a){return a.u.length-a.aa}function N(a){var b=a.aa;b<a.u.length&&b++;return new P(a.u,b)}function me(a){return a.aa<a.u.length?a.u[a.u.length-1]:null}h=P.prototype;
h.toString=function(){for(var a="",b=this.aa;b<this.u.length;b++)""!==this.u[b]&&(a+="/"+this.u[b]);return a||"/"};h.slice=function(a){return this.u.slice(this.aa+(a||0))};h.parent=function(){if(this.aa>=this.u.length)return null;for(var a=[],b=this.aa;b<this.u.length-1;b++)a.push(this.u[b]);return new P(a,0)};
h.o=function(a){for(var b=[],c=this.aa;c<this.u.length;c++)b.push(this.u[c]);if(a instanceof P)for(c=a.aa;c<a.u.length;c++)b.push(a.u[c]);else for(a=a.split("/"),c=0;c<a.length;c++)0<a[c].length&&b.push(a[c]);return new P(b,0)};h.e=function(){return this.aa>=this.u.length};h.ea=function(a){if(le(this)!==le(a))return!1;for(var b=this.aa,c=a.aa;b<=this.u.length;b++,c++)if(this.u[b]!==a.u[c])return!1;return!0};
h.contains=function(a){var b=this.aa,c=a.aa;if(le(this)>le(a))return!1;for(;b<this.u.length;){if(this.u[b]!==a.u[c])return!1;++b;++c}return!0};var M=new P("");function nf(a,b){this.Ua=a.slice();this.Ka=Math.max(1,this.Ua.length);this.pf=b;for(var c=0;c<this.Ua.length;c++)this.Ka+=Pb(this.Ua[c]);of(this)}nf.prototype.push=function(a){0<this.Ua.length&&(this.Ka+=1);this.Ua.push(a);this.Ka+=Pb(a);of(this)};nf.prototype.pop=function(){var a=this.Ua.pop();this.Ka-=Pb(a);0<this.Ua.length&&--this.Ka};
function of(a){if(768<a.Ka)throw Error(a.pf+"has a key path longer than 768 bytes ("+a.Ka+").");if(32<a.Ua.length)throw Error(a.pf+"path specified exceeds the maximum depth that can be written (32) or object contains a cycle "+pf(a));}function pf(a){return 0==a.Ua.length?"":"in property '"+a.Ua.join(".")+"'"};function qf(a,b){this.value=a;this.children=b||rf}var rf=new Ec(function(a,b){return a===b?0:a<b?-1:1});function sf(a){var b=qe;v(a,function(a,d){b=b.set(new P(d),a)});return b}h=qf.prototype;h.e=function(){return null===this.value&&this.children.e()};function tf(a,b,c){if(null!=a.value&&c(a.value))return{path:M,value:a.value};if(b.e())return null;var d=K(b);a=a.children.get(d);return null!==a?(b=tf(a,N(b),c),null!=b?{path:(new P(d)).o(b.path),value:b.value}:null):null}
function uf(a,b){return tf(a,b,function(){return!0})}h.subtree=function(a){if(a.e())return this;var b=this.children.get(K(a));return null!==b?b.subtree(N(a)):qe};h.set=function(a,b){if(a.e())return new qf(b,this.children);var c=K(a),d=(this.children.get(c)||qe).set(N(a),b),c=this.children.Sa(c,d);return new qf(this.value,c)};
h.remove=function(a){if(a.e())return this.children.e()?qe:new qf(null,this.children);var b=K(a),c=this.children.get(b);return c?(a=c.remove(N(a)),b=a.e()?this.children.remove(b):this.children.Sa(b,a),null===this.value&&b.e()?qe:new qf(this.value,b)):this};h.get=function(a){if(a.e())return this.value;var b=this.children.get(K(a));return b?b.get(N(a)):null};
function pe(a,b,c){if(b.e())return c;var d=K(b);b=pe(a.children.get(d)||qe,N(b),c);d=b.e()?a.children.remove(d):a.children.Sa(d,b);return new qf(a.value,d)}function vf(a,b){return wf(a,M,b)}function wf(a,b,c){var d={};a.children.ka(function(a,f){d[a]=wf(f,b.o(a),c)});return c(b,a.value,d)}function xf(a,b,c){return yf(a,b,M,c)}function yf(a,b,c,d){var e=a.value?d(c,a.value):!1;if(e)return e;if(b.e())return null;e=K(b);return(a=a.children.get(e))?yf(a,N(b),c.o(e),d):null}
function zf(a,b,c){Af(a,b,M,c)}function Af(a,b,c,d){if(b.e())return a;a.value&&d(c,a.value);var e=K(b);return(a=a.children.get(e))?Af(a,N(b),c.o(e),d):qe}function ne(a,b){Bf(a,M,b)}function Bf(a,b,c){a.children.ka(function(a,e){Bf(e,b.o(a),c)});a.value&&c(b,a.value)}function Cf(a,b){a.children.ka(function(a,d){d.value&&b(a,d.value)})}var qe=new qf(null);qf.prototype.toString=function(){var a={};ne(this,function(b,c){a[b.toString()]=c.toString()});return G(a)};function Df(a,b,c){this.type=ee;this.source=Ef;this.path=a;this.Ub=b;this.Yd=c}Df.prototype.$c=function(a){if(this.path.e()){if(null!=this.Ub.value)return O(this.Ub.children.e(),"affectedTree should not have overlapping affected paths."),this;a=this.Ub.subtree(new P(a));return new Df(M,a,this.Yd)}O(K(this.path)===a,"operationForChild called for unrelated child.");return new Df(N(this.path),this.Ub,this.Yd)};
Df.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" ack write revert="+this.Yd+" affectedTree="+this.Ub+")"};var Bc=0,be=1,ee=2,Dc=3;function Ff(a,b,c,d){this.Ae=a;this.tf=b;this.Lb=c;this.ef=d;O(!d||b,"Tagged queries must be from server.")}var Ef=new Ff(!0,!1,null,!1),Gf=new Ff(!1,!0,null,!1);Ff.prototype.toString=function(){return this.Ae?"user":this.ef?"server(queryID="+this.Lb+")":"server"};function Hf(a){this.Z=a}var If=new Hf(new qf(null));function Jf(a,b,c){if(b.e())return new Hf(new qf(c));var d=uf(a.Z,b);if(null!=d){var e=d.path,d=d.value;b=lf(e,b);d=d.H(b,c);return new Hf(a.Z.set(e,d))}a=pe(a.Z,b,new qf(c));return new Hf(a)}function Kf(a,b,c){var d=a;Fb(c,function(a,c){d=Jf(d,b.o(a),c)});return d}Hf.prototype.Ud=function(a){if(a.e())return If;a=pe(this.Z,a,qe);return new Hf(a)};function Lf(a,b){var c=uf(a.Z,b);return null!=c?a.Z.get(c.path).S(lf(c.path,b)):null}
function Mf(a){var b=[],c=a.Z.value;null!=c?c.L()||c.R(R,function(a,c){b.push(new L(a,c))}):a.Z.children.ka(function(a,c){null!=c.value&&b.push(new L(a,c.value))});return b}function Nf(a,b){if(b.e())return a;var c=Lf(a,b);return null!=c?new Hf(new qf(c)):new Hf(a.Z.subtree(b))}Hf.prototype.e=function(){return this.Z.e()};Hf.prototype.apply=function(a){return Of(M,this.Z,a)};
function Of(a,b,c){if(null!=b.value)return c.H(a,b.value);var d=null;b.children.ka(function(b,f){".priority"===b?(O(null!==f.value,"Priority writes must always be leaf nodes"),d=f.value):c=Of(a.o(b),f,c)});c.S(a).e()||null===d||(c=c.H(a.o(".priority"),d));return c};function Pf(){this.V=If;this.pa=[];this.Pc=-1}function Qf(a,b){for(var c=0;c<a.pa.length;c++){var d=a.pa[c];if(d.md===b)return d}return null}h=Pf.prototype;
h.Ud=function(a){var b=Sa(this.pa,function(b){return b.md===a});O(0<=b,"removeWrite called with nonexistent writeId.");var c=this.pa[b];this.pa.splice(b,1);for(var d=c.visible,e=!1,f=this.pa.length-1;d&&0<=f;){var g=this.pa[f];g.visible&&(f>=b&&Rf(g,c.path)?d=!1:c.path.contains(g.path)&&(e=!0));f--}if(d){if(e)this.V=Sf(this.pa,Tf,M),this.Pc=0<this.pa.length?this.pa[this.pa.length-1].md:-1;else if(c.Ja)this.V=this.V.Ud(c.path);else{var k=this;v(c.children,function(a,b){k.V=k.V.Ud(c.path.o(b))})}return!0}return!1};
h.Aa=function(a,b,c,d){if(c||d){var e=Nf(this.V,a);return!d&&e.e()?b:d||null!=b||null!=Lf(e,M)?(e=Sf(this.pa,function(b){return(b.visible||d)&&(!c||!(0<=La(c,b.md)))&&(b.path.contains(a)||a.contains(b.path))},a),b=b||H,e.apply(b)):null}e=Lf(this.V,a);if(null!=e)return e;e=Nf(this.V,a);return e.e()?b:null!=b||null!=Lf(e,M)?(b=b||H,e.apply(b)):null};
h.Cc=function(a,b){var c=H,d=Lf(this.V,a);if(d)d.L()||d.R(R,function(a,b){c=c.W(a,b)});else if(b){var e=Nf(this.V,a);b.R(R,function(a,b){var d=Nf(e,new P(a)).apply(b);c=c.W(a,d)});Ma(Mf(e),function(a){c=c.W(a.name,a.U)})}else e=Nf(this.V,a),Ma(Mf(e),function(a){c=c.W(a.name,a.U)});return c};h.nd=function(a,b,c,d){O(c||d,"Either existingEventSnap or existingServerSnap must exist");a=a.o(b);if(null!=Lf(this.V,a))return null;a=Nf(this.V,a);return a.e()?d.S(b):a.apply(d.S(b))};
h.Bc=function(a,b,c){a=a.o(b);var d=Lf(this.V,a);return null!=d?d:Wb(c,b)?Nf(this.V,a).apply(c.j().T(b)):null};h.xc=function(a){return Lf(this.V,a)};h.qe=function(a,b,c,d,e,f){var g;a=Nf(this.V,a);g=Lf(a,M);if(null==g)if(null!=b)g=a.apply(b);else return[];g=g.pb(f);if(g.e()||g.L())return[];b=[];a=Vd(f);e=e?g.dc(c,f):g.bc(c,f);for(f=Ic(e);f&&b.length<d;)0!==a(f,c)&&b.push(f),f=Ic(e);return b};
function Rf(a,b){return a.Ja?a.path.contains(b):!!ta(a.children,function(c,d){return a.path.o(d).contains(b)})}function Tf(a){return a.visible}
function Sf(a,b,c){for(var d=If,e=0;e<a.length;++e){var f=a[e];if(b(f)){var g=f.path;if(f.Ja)c.contains(g)?(g=lf(c,g),d=Jf(d,g,f.Ja)):g.contains(c)&&(g=lf(g,c),d=Jf(d,M,f.Ja.S(g)));else if(f.children)if(c.contains(g))g=lf(c,g),d=Kf(d,g,f.children);else{if(g.contains(c))if(g=lf(g,c),g.e())d=Kf(d,M,f.children);else if(f=z(f.children,K(g)))f=f.S(N(g)),d=Jf(d,M,f)}else throw jd("WriteRecord should have .snap or .children");}}return d}function Uf(a,b){this.Qb=a;this.Z=b}h=Uf.prototype;
h.Aa=function(a,b,c){return this.Z.Aa(this.Qb,a,b,c)};h.Cc=function(a){return this.Z.Cc(this.Qb,a)};h.nd=function(a,b,c){return this.Z.nd(this.Qb,a,b,c)};h.xc=function(a){return this.Z.xc(this.Qb.o(a))};h.qe=function(a,b,c,d,e){return this.Z.qe(this.Qb,a,b,c,d,e)};h.Bc=function(a,b){return this.Z.Bc(this.Qb,a,b)};h.o=function(a){return new Uf(this.Qb.o(a),this.Z)};function Vf(){this.children={};this.pd=0;this.value=null}function Wf(a,b,c){this.Jd=a?a:"";this.Ha=b?b:null;this.A=c?c:new Vf}function Xf(a,b){for(var c=b instanceof P?b:new P(b),d=a,e;null!==(e=K(c));)d=new Wf(e,d,z(d.A.children,e)||new Vf),c=N(c);return d}h=Wf.prototype;h.Ea=function(){return this.A.value};function Yf(a,b){O("undefined"!==typeof b,"Cannot set value to undefined");a.A.value=b;Zf(a)}h.clear=function(){this.A.value=null;this.A.children={};this.A.pd=0;Zf(this)};
h.zd=function(){return 0<this.A.pd};h.e=function(){return null===this.Ea()&&!this.zd()};h.R=function(a){var b=this;v(this.A.children,function(c,d){a(new Wf(d,b,c))})};function $f(a,b,c,d){c&&!d&&b(a);a.R(function(a){$f(a,b,!0,d)});c&&d&&b(a)}function ag(a,b){for(var c=a.parent();null!==c&&!b(c);)c=c.parent()}h.path=function(){return new P(null===this.Ha?this.Jd:this.Ha.path()+"/"+this.Jd)};h.name=function(){return this.Jd};h.parent=function(){return this.Ha};
function Zf(a){if(null!==a.Ha){var b=a.Ha,c=a.Jd,d=a.e(),e=y(b.A.children,c);d&&e?(delete b.A.children[c],b.A.pd--,Zf(b)):d||e||(b.A.children[c]=a.A,b.A.pd++,Zf(b))}};var bg=/[\[\].#$\/\u0000-\u001F\u007F]/,cg=/[\[\].#$\u0000-\u001F\u007F]/,dg=/^[a-zA-Z][a-zA-Z._\-+]+$/;function eg(a){return q(a)&&0!==a.length&&!bg.test(a)}function fg(a){return null===a||q(a)||fa(a)&&!td(a)||ga(a)&&y(a,".sv")}function gg(a,b,c,d){d&&!p(b)||hg(E(a,1,d),b,c)}
function hg(a,b,c){c instanceof P&&(c=new nf(c,a));if(!p(b))throw Error(a+"contains undefined "+pf(c));if(r(b))throw Error(a+"contains a function "+pf(c)+" with contents: "+b.toString());if(td(b))throw Error(a+"contains "+b.toString()+" "+pf(c));if(q(b)&&b.length>10485760/3&&10485760<Pb(b))throw Error(a+"contains a string greater than 10485760 utf8 bytes "+pf(c)+" ('"+b.substring(0,50)+"...')");if(ga(b)){var d=!1,e=!1;Fb(b,function(b,g){if(".value"===b)d=!0;else if(".priority"!==b&&".sv"!==b&&(e=
!0,!eg(b)))throw Error(a+" contains an invalid key ("+b+") "+pf(c)+'.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');c.push(b);hg(a,g,c);c.pop()});if(d&&e)throw Error(a+' contains ".value" child '+pf(c)+" in addition to actual children.");}}
function ig(a,b){var c,d;for(c=0;c<b.length;c++){d=b[c];for(var e=d.slice(),f=0;f<e.length;f++)if((".priority"!==e[f]||f!==e.length-1)&&!eg(e[f]))throw Error(a+"contains an invalid key ("+e[f]+") in path "+d.toString()+'. Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');}b.sort(mf);e=null;for(c=0;c<b.length;c++){d=b[c];if(null!==e&&e.contains(d))throw Error(a+"contains a path "+e.toString()+" that is ancestor of another path "+d.toString());e=d}}
function jg(a,b,c){var d=E(a,1,!1);if(!ga(b)||da(b))throw Error(d+" must be an object containing the children to replace.");var e=[];Fb(b,function(a,b){var k=new P(a);hg(d,b,c.o(k));if(".priority"===me(k)&&!fg(b))throw Error(d+"contains an invalid value for '"+k.toString()+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");e.push(k)});ig(d,e)}
function kg(a,b,c){if(td(c))throw Error(E(a,b,!1)+"is "+c.toString()+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!fg(c))throw Error(E(a,b,!1)+"must be a valid Firebase priority (a string, finite number, server value, or null).");}
function lg(a,b,c){if(!c||p(b))switch(b){case "value":case "child_added":case "child_removed":case "child_changed":case "child_moved":break;default:throw Error(E(a,1,c)+'must be a valid event type: "value", "child_added", "child_removed", "child_changed", or "child_moved".');}}function mg(a,b){if(p(b)&&!eg(b))throw Error(E(a,2,!0)+'was an invalid key: "'+b+'".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").');}
function ng(a,b){if(!q(b)||0===b.length||cg.test(b))throw Error(E(a,1,!1)+'was an invalid path: "'+b+'". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"');}function og(a,b){if(".info"===K(b))throw Error(a+" failed: Can't modify data under /.info/");}function pg(a,b){if(!q(b))throw Error(E(a,1,!1)+"must be a valid credential (a string).");}function qg(a,b,c){if(!q(c))throw Error(E(a,b,!1)+"must be a valid string.");}
function rg(a,b){qg(a,1,b);if(!dg.test(b))throw Error(E(a,1,!1)+"'"+b+"' is not a valid authentication provider.");}function sg(a,b,c,d){if(!d||p(c))if(!ga(c)||null===c)throw Error(E(a,b,d)+"must be a valid object.");}function tg(a,b,c){if(!ga(b)||!y(b,c))throw Error(E(a,1,!1)+'must contain the key "'+c+'"');if(!q(z(b,c)))throw Error(E(a,1,!1)+'must contain the key "'+c+'" with type "string"');};function ug(){this.set={}}h=ug.prototype;h.add=function(a,b){this.set[a]=null!==b?b:!0};h.contains=function(a){return y(this.set,a)};h.get=function(a){return this.contains(a)?this.set[a]:void 0};h.remove=function(a){delete this.set[a]};h.clear=function(){this.set={}};h.e=function(){return va(this.set)};h.count=function(){return oa(this.set)};function vg(a,b){v(a.set,function(a,d){b(d,a)})}h.keys=function(){var a=[];v(this.set,function(b,c){a.push(c)});return a};function Vc(){this.m=this.B=null}Vc.prototype.find=function(a){if(null!=this.B)return this.B.S(a);if(a.e()||null==this.m)return null;var b=K(a);a=N(a);return this.m.contains(b)?this.m.get(b).find(a):null};Vc.prototype.rc=function(a,b){if(a.e())this.B=b,this.m=null;else if(null!==this.B)this.B=this.B.H(a,b);else{null==this.m&&(this.m=new ug);var c=K(a);this.m.contains(c)||this.m.add(c,new Vc);c=this.m.get(c);a=N(a);c.rc(a,b)}};
function wg(a,b){if(b.e())return a.B=null,a.m=null,!0;if(null!==a.B){if(a.B.L())return!1;var c=a.B;a.B=null;c.R(R,function(b,c){a.rc(new P(b),c)});return wg(a,b)}return null!==a.m?(c=K(b),b=N(b),a.m.contains(c)&&wg(a.m.get(c),b)&&a.m.remove(c),a.m.e()?(a.m=null,!0):!1):!0}function Wc(a,b,c){null!==a.B?c(b,a.B):a.R(function(a,e){var f=new P(b.toString()+"/"+a);Wc(e,f,c)})}Vc.prototype.R=function(a){null!==this.m&&vg(this.m,function(b,c){a(b,c)})};var xg="auth.firebase.com";function yg(a,b,c){this.qd=a||{};this.he=b||{};this.fb=c||{};this.qd.remember||(this.qd.remember="default")}var zg=["remember","redirectTo"];function Ag(a){var b={},c={};Fb(a||{},function(a,e){0<=La(zg,a)?b[a]=e:c[a]=e});return new yg(b,{},c)};function Bg(a,b){this.Ue=["session",a.Rd,a.lc].join(":");this.ee=b}Bg.prototype.set=function(a,b){if(!b)if(this.ee.length)b=this.ee[0];else throw Error("fb.login.SessionManager : No storage options available!");b.set(this.Ue,a)};Bg.prototype.get=function(){var a=Oa(this.ee,u(this.Bg,this)),a=Na(a,function(a){return null!==a});Va(a,function(a,c){return Dd(c.token)-Dd(a.token)});return 0<a.length?a.shift():null};Bg.prototype.Bg=function(a){try{var b=a.get(this.Ue);if(b&&b.token)return b}catch(c){}return null};
Bg.prototype.clear=function(){var a=this;Ma(this.ee,function(b){b.remove(a.Ue)})};function Cg(){return"undefined"!==typeof navigator&&"string"===typeof navigator.userAgent?navigator.userAgent:""}function Dg(){return"undefined"!==typeof window&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(Cg())}function Eg(){return"undefined"!==typeof location&&/^file:\//.test(location.href)}
function Fg(a){var b=Cg();if(""===b)return!1;if("Microsoft Internet Explorer"===navigator.appName){if((b=b.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/))&&1<b.length)return parseFloat(b[1])>=a}else if(-1<b.indexOf("Trident")&&(b=b.match(/rv:([0-9]{2,2}[\.0-9]{0,})/))&&1<b.length)return parseFloat(b[1])>=a;return!1};function Gg(){var a=window.opener.frames,b;for(b=a.length-1;0<=b;b--)try{if(a[b].location.protocol===window.location.protocol&&a[b].location.host===window.location.host&&"__winchan_relay_frame"===a[b].name)return a[b]}catch(c){}return null}function Hg(a,b,c){a.attachEvent?a.attachEvent("on"+b,c):a.addEventListener&&a.addEventListener(b,c,!1)}function Ig(a,b,c){a.detachEvent?a.detachEvent("on"+b,c):a.removeEventListener&&a.removeEventListener(b,c,!1)}
function Jg(a){/^https?:\/\//.test(a)||(a=window.location.href);var b=/^(https?:\/\/[\-_a-zA-Z\.0-9:]+)/.exec(a);return b?b[1]:a}function Kg(a){var b="";try{a=a.replace(/.*\?/,"");var c=Jb(a);c&&y(c,"__firebase_request_key")&&(b=z(c,"__firebase_request_key"))}catch(d){}return b}function Lg(){try{var a=document.location.hash.replace(/&__firebase_request_key=([a-zA-z0-9]*)/,""),a=a.replace(/\?$/,""),a=a.replace(/^#+$/,"");document.location.hash=a}catch(b){}}
function Mg(){var a=sd(xg);return a.scheme+"://"+a.host+"/v2"}function Ng(a){return Mg()+"/"+a+"/auth/channel"};function Og(a){var b=this;this.hb=a;this.fe="*";Fg(8)?this.Uc=this.Cd=Gg():(this.Uc=window.opener,this.Cd=window);if(!b.Uc)throw"Unable to find relay frame";Hg(this.Cd,"message",u(this.nc,this));Hg(this.Cd,"message",u(this.Ff,this));try{Pg(this,{a:"ready"})}catch(c){Hg(this.Uc,"load",function(){Pg(b,{a:"ready"})})}Hg(window,"unload",u(this.Mg,this))}function Pg(a,b){b=G(b);Fg(8)?a.Uc.doPost(b,a.fe):a.Uc.postMessage(b,a.fe)}
Og.prototype.nc=function(a){var b=this,c;try{c=Rb(a.data)}catch(d){}c&&"request"===c.a&&(Ig(window,"message",this.nc),this.fe=a.origin,this.hb&&setTimeout(function(){b.hb(b.fe,c.d,function(a,c){b.mg=!c;b.hb=void 0;Pg(b,{a:"response",d:a,forceKeepWindowOpen:c})})},0))};Og.prototype.Mg=function(){try{Ig(this.Cd,"message",this.Ff)}catch(a){}this.hb&&(Pg(this,{a:"error",d:"unknown closed window"}),this.hb=void 0);try{window.close()}catch(b){}};Og.prototype.Ff=function(a){if(this.mg&&"die"===a.data)try{window.close()}catch(b){}};function Qg(a){this.tc=Fa()+Fa()+Fa();this.Kf=a}Qg.prototype.open=function(a,b){cd.set("redirect_request_id",this.tc);cd.set("redirect_request_id",this.tc);b.requestId=this.tc;b.redirectTo=b.redirectTo||window.location.href;a+=(/\?/.test(a)?"":"?")+Ib(b);window.location=a};Qg.isAvailable=function(){return!Eg()&&!Dg()};Qg.prototype.Fc=function(){return"redirect"};var Rg={NETWORK_ERROR:"Unable to contact the Firebase server.",SERVER_ERROR:"An unknown server error occurred.",TRANSPORT_UNAVAILABLE:"There are no login transports available for the requested method.",REQUEST_INTERRUPTED:"The browser redirected the page before the login request could complete.",USER_CANCELLED:"The user cancelled authentication."};function Sg(a){var b=Error(z(Rg,a),a);b.code=a;return b};function Tg(a){var b;(b=!a.window_features)||(b=Cg(),b=-1!==b.indexOf("Fennec/")||-1!==b.indexOf("Firefox/")&&-1!==b.indexOf("Android"));b&&(a.window_features=void 0);a.window_name||(a.window_name="_blank");this.options=a}
Tg.prototype.open=function(a,b,c){function d(a){g&&(document.body.removeChild(g),g=void 0);t&&(t=clearInterval(t));Ig(window,"message",e);Ig(window,"unload",d);if(l&&!a)try{l.close()}catch(b){k.postMessage("die",m)}l=k=void 0}function e(a){if(a.origin===m)try{var b=Rb(a.data);"ready"===b.a?k.postMessage(A,m):"error"===b.a?(d(!1),c&&(c(b.d),c=null)):"response"===b.a&&(d(b.forceKeepWindowOpen),c&&(c(null,b.d),c=null))}catch(e){}}var f=Fg(8),g,k;if(!this.options.relay_url)return c(Error("invalid arguments: origin of url and relay_url must match"));
var m=Jg(a);if(m!==Jg(this.options.relay_url))c&&setTimeout(function(){c(Error("invalid arguments: origin of url and relay_url must match"))},0);else{f&&(g=document.createElement("iframe"),g.setAttribute("src",this.options.relay_url),g.style.display="none",g.setAttribute("name","__winchan_relay_frame"),document.body.appendChild(g),k=g.contentWindow);a+=(/\?/.test(a)?"":"?")+Ib(b);var l=window.open(a,this.options.window_name,this.options.window_features);k||(k=l);var t=setInterval(function(){l&&l.closed&&
(d(!1),c&&(c(Sg("USER_CANCELLED")),c=null))},500),A=G({a:"request",d:b});Hg(window,"unload",d);Hg(window,"message",e)}};
Tg.isAvailable=function(){var a;if(a="postMessage"in window&&!Eg())(a=Dg()||"undefined"!==typeof navigator&&(!!Cg().match(/Windows Phone/)||!!window.Windows&&/^ms-appx:/.test(location.href)))||(a=Cg(),a="undefined"!==typeof navigator&&"undefined"!==typeof window&&!!(a.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i)||a.match(/CriOS/)||a.match(/Twitter for iPhone/)||a.match(/FBAN\/FBIOS/)||window.navigator.standalone)),a=!a;return a&&!Cg().match(/PhantomJS/)};Tg.prototype.Fc=function(){return"popup"};function Ug(a){a.method||(a.method="GET");a.headers||(a.headers={});a.headers.content_type||(a.headers.content_type="application/json");a.headers.content_type=a.headers.content_type.toLowerCase();this.options=a}
Ug.prototype.open=function(a,b,c){function d(){c&&(c(Sg("REQUEST_INTERRUPTED")),c=null)}var e=new XMLHttpRequest,f=this.options.method.toUpperCase(),g;Hg(window,"beforeunload",d);e.onreadystatechange=function(){if(c&&4===e.readyState){var a;if(200<=e.status&&300>e.status){try{a=Rb(e.responseText)}catch(b){}c(null,a)}else 500<=e.status&&600>e.status?c(Sg("SERVER_ERROR")):c(Sg("NETWORK_ERROR"));c=null;Ig(window,"beforeunload",d)}};if("GET"===f)a+=(/\?/.test(a)?"":"?")+Ib(b),g=null;else{var k=this.options.headers.content_type;
"application/json"===k&&(g=G(b));"application/x-www-form-urlencoded"===k&&(g=Ib(b))}e.open(f,a,!0);a={"X-Requested-With":"XMLHttpRequest",Accept:"application/json;text/plain"};ya(a,this.options.headers);for(var m in a)e.setRequestHeader(m,a[m]);e.send(g)};Ug.isAvailable=function(){var a;if(a=!!window.XMLHttpRequest)a=Cg(),a=!(a.match(/MSIE/)||a.match(/Trident/))||Fg(10);return a};Ug.prototype.Fc=function(){return"json"};function Vg(a){this.tc=Fa()+Fa()+Fa();this.Kf=a}
Vg.prototype.open=function(a,b,c){function d(){c&&(c(Sg("USER_CANCELLED")),c=null)}var e=this,f=sd(xg),g;b.requestId=this.tc;b.redirectTo=f.scheme+"://"+f.host+"/blank/page.html";a+=/\?/.test(a)?"":"?";a+=Ib(b);(g=window.open(a,"_blank","location=no"))&&r(g.addEventListener)?(g.addEventListener("loadstart",function(a){var b;if(b=a&&a.url)a:{try{var l=document.createElement("a");l.href=a.url;b=l.host===f.host&&"/blank/page.html"===l.pathname;break a}catch(t){}b=!1}b&&(a=Kg(a.url),g.removeEventListener("exit",
d),g.close(),a=new yg(null,null,{requestId:e.tc,requestKey:a}),e.Kf.requestWithCredential("/auth/session",a,c),c=null)}),g.addEventListener("exit",d)):c(Sg("TRANSPORT_UNAVAILABLE"))};Vg.isAvailable=function(){return Dg()};Vg.prototype.Fc=function(){return"redirect"};function Wg(a){a.callback_parameter||(a.callback_parameter="callback");this.options=a;window.__firebase_auth_jsonp=window.__firebase_auth_jsonp||{}}
Wg.prototype.open=function(a,b,c){function d(){c&&(c(Sg("REQUEST_INTERRUPTED")),c=null)}function e(){setTimeout(function(){window.__firebase_auth_jsonp[f]=void 0;va(window.__firebase_auth_jsonp)&&(window.__firebase_auth_jsonp=void 0);try{var a=document.getElementById(f);a&&a.parentNode.removeChild(a)}catch(b){}},1);Ig(window,"beforeunload",d)}var f="fn"+(new Date).getTime()+Math.floor(99999*Math.random());b[this.options.callback_parameter]="__firebase_auth_jsonp."+f;a+=(/\?/.test(a)?"":"?")+Ib(b);
Hg(window,"beforeunload",d);window.__firebase_auth_jsonp[f]=function(a){c&&(c(null,a),c=null);e()};Xg(f,a,c)};
function Xg(a,b,c){setTimeout(function(){try{var d=document.createElement("script");d.type="text/javascript";d.id=a;d.async=!0;d.src=b;d.onerror=function(){var b=document.getElementById(a);null!==b&&b.parentNode.removeChild(b);c&&c(Sg("NETWORK_ERROR"))};var e=document.getElementsByTagName("head");(e&&0!=e.length?e[0]:document.documentElement).appendChild(d)}catch(f){c&&c(Sg("NETWORK_ERROR"))}},0)}Wg.isAvailable=function(){return"undefined"!==typeof document&&null!=document.createElement};
Wg.prototype.Fc=function(){return"json"};function Yg(a,b,c,d){ff.call(this,["auth_status"]);this.G=a;this.hf=b;this.hh=c;this.Pe=d;this.wc=new Bg(a,[bd,cd]);this.qb=null;this.We=!1;Zg(this)}ka(Yg,ff);h=Yg.prototype;h.Be=function(){return this.qb||null};function Zg(a){cd.get("redirect_request_id")&&$g(a);var b=a.wc.get();b&&b.token?(ah(a,b),a.hf(b.token,function(c,d){bh(a,c,d,!1,b.token,b)},function(b,d){ch(a,"resumeSession()",b,d)})):ah(a,null)}
function dh(a,b,c,d,e,f){"firebaseio-demo.com"===a.G.domain&&S("Firebase authentication is not supported on demo Firebases (*.firebaseio-demo.com). To secure your Firebase, create a production Firebase at https://www.firebase.com.");a.hf(b,function(f,k){bh(a,f,k,!0,b,c,d||{},e)},function(b,c){ch(a,"auth()",b,c,f)})}function eh(a,b){a.wc.clear();ah(a,null);a.hh(function(a,d){if("ok"===a)T(b,null);else{var e=(a||"error").toUpperCase(),f=e;d&&(f+=": "+d);f=Error(f);f.code=e;T(b,f)}})}
function bh(a,b,c,d,e,f,g,k){"ok"===b?(d&&(b=c.auth,f.auth=b,f.expires=c.expires,f.token=Ed(e)?e:"",c=null,b&&y(b,"uid")?c=z(b,"uid"):y(f,"uid")&&(c=z(f,"uid")),f.uid=c,c="custom",b&&y(b,"provider")?c=z(b,"provider"):y(f,"provider")&&(c=z(f,"provider")),f.provider=c,a.wc.clear(),Ed(e)&&(g=g||{},c=bd,"sessionOnly"===g.remember&&(c=cd),"none"!==g.remember&&a.wc.set(f,c)),ah(a,f)),T(k,null,f)):(a.wc.clear(),ah(a,null),f=a=(b||"error").toUpperCase(),c&&(f+=": "+c),f=Error(f),f.code=a,T(k,f))}
function ch(a,b,c,d,e){S(b+" was canceled: "+d);a.wc.clear();ah(a,null);a=Error(d);a.code=c.toUpperCase();T(e,a)}function fh(a,b,c,d,e){gh(a);c=new yg(d||{},{},c||{});hh(a,[Ug,Wg],"/auth/"+b,c,e)}
function ih(a,b,c,d){gh(a);var e=[Tg,Vg];c=Ag(c);var f=625;"anonymous"===b||"password"===b?setTimeout(function(){T(d,Sg("TRANSPORT_UNAVAILABLE"))},0):("github"===b&&(f=1025),c.he.window_features="menubar=yes,modal=yes,alwaysRaised=yeslocation=yes,resizable=yes,scrollbars=yes,status=yes,height=625,width="+f+",top="+("object"===typeof screen?.5*(screen.height-625):0)+",left="+("object"===typeof screen?.5*(screen.width-f):0),c.he.relay_url=Ng(a.G.lc),c.he.requestWithCredential=u(a.uc,a),hh(a,e,"/auth/"+
b,c,d))}function $g(a){var b=cd.get("redirect_request_id");if(b){var c=cd.get("redirect_client_options");cd.remove("redirect_request_id");cd.remove("redirect_client_options");var d=[Ug,Wg],b={requestId:b,requestKey:Kg(document.location.hash)},c=new yg(c,{},b);a.We=!0;Lg();hh(a,d,"/auth/session",c,function(){this.We=!1}.bind(a))}}h.ve=function(a,b){gh(this);var c=Ag(a);c.fb._method="POST";this.uc("/users",c,function(a,c){a?T(b,a):T(b,a,c)})};
h.Xe=function(a,b){var c=this;gh(this);var d="/users/"+encodeURIComponent(a.email),e=Ag(a);e.fb._method="DELETE";this.uc(d,e,function(a,d){!a&&d&&d.uid&&c.qb&&c.qb.uid&&c.qb.uid===d.uid&&eh(c);T(b,a)})};h.se=function(a,b){gh(this);var c="/users/"+encodeURIComponent(a.email)+"/password",d=Ag(a);d.fb._method="PUT";d.fb.password=a.newPassword;this.uc(c,d,function(a){T(b,a)})};
h.re=function(a,b){gh(this);var c="/users/"+encodeURIComponent(a.oldEmail)+"/email",d=Ag(a);d.fb._method="PUT";d.fb.email=a.newEmail;d.fb.password=a.password;this.uc(c,d,function(a){T(b,a)})};h.Ze=function(a,b){gh(this);var c="/users/"+encodeURIComponent(a.email)+"/password",d=Ag(a);d.fb._method="POST";this.uc(c,d,function(a){T(b,a)})};h.uc=function(a,b,c){jh(this,[Ug,Wg],a,b,c)};
function hh(a,b,c,d,e){jh(a,b,c,d,function(b,c){!b&&c&&c.token&&c.uid?dh(a,c.token,c,d.qd,function(a,b){a?T(e,a):T(e,null,b)}):T(e,b||Sg("UNKNOWN_ERROR"))})}
function jh(a,b,c,d,e){b=Na(b,function(a){return"function"===typeof a.isAvailable&&a.isAvailable()});0===b.length?setTimeout(function(){T(e,Sg("TRANSPORT_UNAVAILABLE"))},0):(b=new (b.shift())(d.he),d=Gb(d.fb),d.v="js-"+Eb,d.transport=b.Fc(),d.suppress_status_codes=!0,a=Mg()+"/"+a.G.lc+c,b.open(a,d,function(a,b){if(a)T(e,a);else if(b&&b.error){var c=Error(b.error.message);c.code=b.error.code;c.details=b.error.details;T(e,c)}else T(e,null,b)}))}
function ah(a,b){var c=null!==a.qb||null!==b;a.qb=b;c&&a.ie("auth_status",b);a.Pe(null!==b)}h.Ee=function(a){O("auth_status"===a,'initial event must be of type "auth_status"');return this.We?null:[this.qb]};function gh(a){var b=a.G;if("firebaseio.com"!==b.domain&&"firebaseio-demo.com"!==b.domain&&"auth.firebase.com"===xg)throw Error("This custom Firebase server ('"+a.G.domain+"') does not support delegated login.");};var gd="websocket",hd="long_polling";function kh(a){this.nc=a;this.Qd=[];this.Wb=0;this.te=-1;this.Jb=null}function lh(a,b,c){a.te=b;a.Jb=c;a.te<a.Wb&&(a.Jb(),a.Jb=null)}function mh(a,b,c){for(a.Qd[b]=c;a.Qd[a.Wb];){var d=a.Qd[a.Wb];delete a.Qd[a.Wb];for(var e=0;e<d.length;++e)if(d[e]){var f=a;gc(function(){f.nc(d[e])})}if(a.Wb===a.te){a.Jb&&(clearTimeout(a.Jb),a.Jb(),a.Jb=null);break}a.Wb++}};function nh(a,b,c,d){this.ue=a;this.f=pd(a);this.rb=this.sb=0;this.Xa=uc(b);this.Xf=c;this.Kc=!1;this.Fb=d;this.ld=function(a){return fd(b,hd,a)}}var oh,ph;
nh.prototype.open=function(a,b){this.mf=0;this.na=b;this.Ef=new kh(a);this.Db=!1;var c=this;this.ub=setTimeout(function(){c.f("Timed out trying to connect.");c.bb();c.ub=null},Math.floor(3E4));ud(function(){if(!c.Db){c.Wa=new qh(function(a,b,d,k,m){rh(c,arguments);if(c.Wa)if(c.ub&&(clearTimeout(c.ub),c.ub=null),c.Kc=!0,"start"==a)c.id=b,c.Mf=d;else if("close"===a)b?(c.Wa.$d=!1,lh(c.Ef,b,function(){c.bb()})):c.bb();else throw Error("Unrecognized command received: "+a);},function(a,b){rh(c,arguments);
mh(c.Ef,a,b)},function(){c.bb()},c.ld);var a={start:"t"};a.ser=Math.floor(1E8*Math.random());c.Wa.ke&&(a.cb=c.Wa.ke);a.v="5";c.Xf&&(a.s=c.Xf);c.Fb&&(a.ls=c.Fb);"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");a=c.ld(a);c.f("Connecting via long-poll to "+a);sh(c.Wa,a,function(){})}})};
nh.prototype.start=function(){var a=this.Wa,b=this.Mf;a.Fg=this.id;a.Gg=b;for(a.oe=!0;th(a););a=this.id;b=this.Mf;this.kc=document.createElement("iframe");var c={dframe:"t"};c.id=a;c.pw=b;this.kc.src=this.ld(c);this.kc.style.display="none";document.body.appendChild(this.kc)};
nh.isAvailable=function(){return oh||!ph&&"undefined"!==typeof document&&null!=document.createElement&&!("object"===typeof window&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))&&!("object"===typeof Windows&&"object"===typeof Windows.jh)&&!0};h=nh.prototype;h.Hd=function(){};h.fd=function(){this.Db=!0;this.Wa&&(this.Wa.close(),this.Wa=null);this.kc&&(document.body.removeChild(this.kc),this.kc=null);this.ub&&(clearTimeout(this.ub),this.ub=null)};
h.bb=function(){this.Db||(this.f("Longpoll is closing itself"),this.fd(),this.na&&(this.na(this.Kc),this.na=null))};h.close=function(){this.Db||(this.f("Longpoll is being closed."),this.fd())};h.send=function(a){a=G(a);this.sb+=a.length;rc(this.Xa,"bytes_sent",a.length);a=Ob(a);a=nb(a,!0);a=yd(a,1840);for(var b=0;b<a.length;b++){var c=this.Wa;c.cd.push({Xg:this.mf,gh:a.length,of:a[b]});c.oe&&th(c);this.mf++}};function rh(a,b){var c=G(b).length;a.rb+=c;rc(a.Xa,"bytes_received",c)}
function qh(a,b,c,d){this.ld=d;this.lb=c;this.Te=new ug;this.cd=[];this.we=Math.floor(1E8*Math.random());this.$d=!0;this.ke=id();window["pLPCommand"+this.ke]=a;window["pRTLPCB"+this.ke]=b;a=document.createElement("iframe");a.style.display="none";if(document.body){document.body.appendChild(a);try{a.contentWindow.document||fc("No IE domain setting required")}catch(e){a.src="javascript:void((function(){document.open();document.domain='"+document.domain+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";
a.contentDocument?a.jb=a.contentDocument:a.contentWindow?a.jb=a.contentWindow.document:a.document&&(a.jb=a.document);this.Ga=a;a="";this.Ga.src&&"javascript:"===this.Ga.src.substr(0,11)&&(a='<script>document.domain="'+document.domain+'";\x3c/script>');a="<html><body>"+a+"</body></html>";try{this.Ga.jb.open(),this.Ga.jb.write(a),this.Ga.jb.close()}catch(f){fc("frame writing exception"),f.stack&&fc(f.stack),fc(f)}}
qh.prototype.close=function(){this.oe=!1;if(this.Ga){this.Ga.jb.body.innerHTML="";var a=this;setTimeout(function(){null!==a.Ga&&(document.body.removeChild(a.Ga),a.Ga=null)},Math.floor(0))}var b=this.lb;b&&(this.lb=null,b())};
function th(a){if(a.oe&&a.$d&&a.Te.count()<(0<a.cd.length?2:1)){a.we++;var b={};b.id=a.Fg;b.pw=a.Gg;b.ser=a.we;for(var b=a.ld(b),c="",d=0;0<a.cd.length;)if(1870>=a.cd[0].of.length+30+c.length){var e=a.cd.shift(),c=c+"&seg"+d+"="+e.Xg+"&ts"+d+"="+e.gh+"&d"+d+"="+e.of;d++}else break;uh(a,b+c,a.we);return!0}return!1}function uh(a,b,c){function d(){a.Te.remove(c);th(a)}a.Te.add(c,1);var e=setTimeout(d,Math.floor(25E3));sh(a,b,function(){clearTimeout(e);d()})}
function sh(a,b,c){setTimeout(function(){try{if(a.$d){var d=a.Ga.jb.createElement("script");d.type="text/javascript";d.async=!0;d.src=b;d.onload=d.onreadystatechange=function(){var a=d.readyState;a&&"loaded"!==a&&"complete"!==a||(d.onload=d.onreadystatechange=null,d.parentNode&&d.parentNode.removeChild(d),c())};d.onerror=function(){fc("Long-poll script failed to load: "+b);a.$d=!1;a.close()};a.Ga.jb.body.appendChild(d)}}catch(e){}},Math.floor(1))};var vh=null;"undefined"!==typeof MozWebSocket?vh=MozWebSocket:"undefined"!==typeof WebSocket&&(vh=WebSocket);function wh(a,b,c,d){this.ue=a;this.f=pd(this.ue);this.frames=this.Nc=null;this.rb=this.sb=this.ff=0;this.Xa=uc(b);a={v:"5"};"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");c&&(a.s=c);d&&(a.ls=d);this.jf=fd(b,gd,a)}var xh;
wh.prototype.open=function(a,b){this.lb=b;this.Kg=a;this.f("Websocket connecting to "+this.jf);this.Kc=!1;bd.set("previous_websocket_failure",!0);try{this.La=new vh(this.jf)}catch(c){this.f("Error instantiating WebSocket.");var d=c.message||c.data;d&&this.f(d);this.bb();return}var e=this;this.La.onopen=function(){e.f("Websocket connected.");e.Kc=!0};this.La.onclose=function(){e.f("Websocket connection was disconnected.");e.La=null;e.bb()};this.La.onmessage=function(a){if(null!==e.La)if(a=a.data,e.rb+=
a.length,rc(e.Xa,"bytes_received",a.length),yh(e),null!==e.frames)zh(e,a);else{a:{O(null===e.frames,"We already have a frame buffer");if(6>=a.length){var b=Number(a);if(!isNaN(b)){e.ff=b;e.frames=[];a=null;break a}}e.ff=1;e.frames=[]}null!==a&&zh(e,a)}};this.La.onerror=function(a){e.f("WebSocket error.  Closing connection.");(a=a.message||a.data)&&e.f(a);e.bb()}};wh.prototype.start=function(){};
wh.isAvailable=function(){var a=!1;if("undefined"!==typeof navigator&&navigator.userAgent){var b=navigator.userAgent.match(/Android ([0-9]{0,}\.[0-9]{0,})/);b&&1<b.length&&4.4>parseFloat(b[1])&&(a=!0)}return!a&&null!==vh&&!xh};wh.responsesRequiredToBeHealthy=2;wh.healthyTimeout=3E4;h=wh.prototype;h.Hd=function(){bd.remove("previous_websocket_failure")};function zh(a,b){a.frames.push(b);if(a.frames.length==a.ff){var c=a.frames.join("");a.frames=null;c=Rb(c);a.Kg(c)}}
h.send=function(a){yh(this);a=G(a);this.sb+=a.length;rc(this.Xa,"bytes_sent",a.length);a=yd(a,16384);1<a.length&&Ah(this,String(a.length));for(var b=0;b<a.length;b++)Ah(this,a[b])};h.fd=function(){this.Db=!0;this.Nc&&(clearInterval(this.Nc),this.Nc=null);this.La&&(this.La.close(),this.La=null)};h.bb=function(){this.Db||(this.f("WebSocket is closing itself"),this.fd(),this.lb&&(this.lb(this.Kc),this.lb=null))};h.close=function(){this.Db||(this.f("WebSocket is being closed"),this.fd())};
function yh(a){clearInterval(a.Nc);a.Nc=setInterval(function(){a.La&&Ah(a,"0");yh(a)},Math.floor(45E3))}function Ah(a,b){try{a.La.send(b)}catch(c){a.f("Exception thrown from WebSocket.send():",c.message||c.data,"Closing connection."),setTimeout(u(a.bb,a),0)}};function Bh(a){Ch(this,a)}var Dh=[nh,wh];function Ch(a,b){var c=wh&&wh.isAvailable(),d=c&&!(bd.Af||!0===bd.get("previous_websocket_failure"));b.ih&&(c||S("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),d=!0);if(d)a.jd=[wh];else{var e=a.jd=[];zd(Dh,function(a,b){b&&b.isAvailable()&&e.push(b)})}}function Eh(a){if(0<a.jd.length)return a.jd[0];throw Error("No transports available");};function Fh(a,b,c,d,e,f,g){this.id=a;this.f=pd("c:"+this.id+":");this.nc=c;this.Zc=d;this.na=e;this.Re=f;this.G=b;this.Pd=[];this.kf=0;this.Wf=new Bh(b);this.N=0;this.Fb=g;this.f("Connection created");Gh(this)}
function Gh(a){var b=Eh(a.Wf);a.K=new b("c:"+a.id+":"+a.kf++,a.G,void 0,a.Fb);a.Ve=b.responsesRequiredToBeHealthy||0;var c=Hh(a,a.K),d=Ih(a,a.K);a.kd=a.K;a.ed=a.K;a.F=null;a.Eb=!1;setTimeout(function(){a.K&&a.K.open(c,d)},Math.floor(0));b=b.healthyTimeout||0;0<b&&(a.Bd=setTimeout(function(){a.Bd=null;a.Eb||(a.K&&102400<a.K.rb?(a.f("Connection exceeded healthy timeout but has received "+a.K.rb+" bytes.  Marking connection healthy."),a.Eb=!0,a.K.Hd()):a.K&&10240<a.K.sb?a.f("Connection exceeded healthy timeout but has sent "+
a.K.sb+" bytes.  Leaving connection alive."):(a.f("Closing unhealthy connection after timeout."),a.close()))},Math.floor(b)))}function Ih(a,b){return function(c){b===a.K?(a.K=null,c||0!==a.N?1===a.N&&a.f("Realtime connection lost."):(a.f("Realtime connection failed."),"s-"===a.G.ab.substr(0,2)&&(bd.remove("host:"+a.G.host),a.G.ab=a.G.host)),a.close()):b===a.F?(a.f("Secondary connection lost."),c=a.F,a.F=null,a.kd!==c&&a.ed!==c||a.close()):a.f("closing an old connection")}}
function Hh(a,b){return function(c){if(2!=a.N)if(b===a.ed){var d=wd("t",c);c=wd("d",c);if("c"==d){if(d=wd("t",c),"d"in c)if(c=c.d,"h"===d){var d=c.ts,e=c.v,f=c.h;a.Uf=c.s;ed(a.G,f);0==a.N&&(a.K.start(),Jh(a,a.K,d),"5"!==e&&S("Protocol version mismatch detected"),c=a.Wf,(c=1<c.jd.length?c.jd[1]:null)&&Kh(a,c))}else if("n"===d){a.f("recvd end transmission on primary");a.ed=a.F;for(c=0;c<a.Pd.length;++c)a.Ld(a.Pd[c]);a.Pd=[];Lh(a)}else"s"===d?(a.f("Connection shutdown command received. Shutting down..."),
a.Re&&(a.Re(c),a.Re=null),a.na=null,a.close()):"r"===d?(a.f("Reset packet received.  New host: "+c),ed(a.G,c),1===a.N?a.close():(Mh(a),Gh(a))):"e"===d?qd("Server Error: "+c):"o"===d?(a.f("got pong on primary."),Nh(a),Oh(a)):qd("Unknown control packet command: "+d)}else"d"==d&&a.Ld(c)}else if(b===a.F)if(d=wd("t",c),c=wd("d",c),"c"==d)"t"in c&&(c=c.t,"a"===c?Ph(a):"r"===c?(a.f("Got a reset on secondary, closing it"),a.F.close(),a.kd!==a.F&&a.ed!==a.F||a.close()):"o"===c&&(a.f("got pong on secondary."),
a.Tf--,Ph(a)));else if("d"==d)a.Pd.push(c);else throw Error("Unknown protocol layer: "+d);else a.f("message on old connection")}}Fh.prototype.Ia=function(a){Qh(this,{t:"d",d:a})};function Lh(a){a.kd===a.F&&a.ed===a.F&&(a.f("cleaning up and promoting a connection: "+a.F.ue),a.K=a.F,a.F=null)}
function Ph(a){0>=a.Tf?(a.f("Secondary connection is healthy."),a.Eb=!0,a.F.Hd(),a.F.start(),a.f("sending client ack on secondary"),a.F.send({t:"c",d:{t:"a",d:{}}}),a.f("Ending transmission on primary"),a.K.send({t:"c",d:{t:"n",d:{}}}),a.kd=a.F,Lh(a)):(a.f("sending ping on secondary."),a.F.send({t:"c",d:{t:"p",d:{}}}))}Fh.prototype.Ld=function(a){Nh(this);this.nc(a)};function Nh(a){a.Eb||(a.Ve--,0>=a.Ve&&(a.f("Primary connection is healthy."),a.Eb=!0,a.K.Hd()))}
function Kh(a,b){a.F=new b("c:"+a.id+":"+a.kf++,a.G,a.Uf);a.Tf=b.responsesRequiredToBeHealthy||0;a.F.open(Hh(a,a.F),Ih(a,a.F));setTimeout(function(){a.F&&(a.f("Timed out trying to upgrade."),a.F.close())},Math.floor(6E4))}function Jh(a,b,c){a.f("Realtime connection established.");a.K=b;a.N=1;a.Zc&&(a.Zc(c,a.Uf),a.Zc=null);0===a.Ve?(a.f("Primary connection is healthy."),a.Eb=!0):setTimeout(function(){Oh(a)},Math.floor(5E3))}
function Oh(a){a.Eb||1!==a.N||(a.f("sending ping on primary."),Qh(a,{t:"c",d:{t:"p",d:{}}}))}function Qh(a,b){if(1!==a.N)throw"Connection is not connected";a.kd.send(b)}Fh.prototype.close=function(){2!==this.N&&(this.f("Closing realtime connection."),this.N=2,Mh(this),this.na&&(this.na(),this.na=null))};function Mh(a){a.f("Shutting down all connections");a.K&&(a.K.close(),a.K=null);a.F&&(a.F.close(),a.F=null);a.Bd&&(clearTimeout(a.Bd),a.Bd=null)};function Rh(a,b,c,d){this.id=Sh++;this.f=pd("p:"+this.id+":");this.Bf=this.Ie=!1;this.ba={};this.sa=[];this.ad=0;this.Yc=[];this.qa=!1;this.eb=1E3;this.Id=3E5;this.Kb=b;this.Xc=c;this.Se=d;this.G=a;this.wb=this.Ca=this.Ma=this.Fb=this.$e=null;this.Sb=!1;this.Wd={};this.Wg=0;this.rf=!0;this.Oc=this.Ke=null;Th(this,0);kf.yb().Ib("visible",this.Ng,this);-1===a.host.indexOf("fblocal")&&jf.yb().Ib("online",this.Lg,this)}var Sh=0,Uh=0;h=Rh.prototype;
h.Ia=function(a,b,c){var d=++this.Wg;a={r:d,a:a,b:b};this.f(G(a));O(this.qa,"sendRequest call when we're not connected not allowed.");this.Ma.Ia(a);c&&(this.Wd[d]=c)};h.Cf=function(a,b,c,d){var e=a.wa(),f=a.path.toString();this.f("Listen called for "+f+" "+e);this.ba[f]=this.ba[f]||{};O(Ie(a.n)||!He(a.n),"listen() called for non-default but complete query");O(!this.ba[f][e],"listen() called twice for same path/queryId.");a={I:d,Ad:b,Tg:a,tag:c};this.ba[f][e]=a;this.qa&&Vh(this,a)};
function Vh(a,b){var c=b.Tg,d=c.path.toString(),e=c.wa();a.f("Listen on "+d+" for "+e);var f={p:d};b.tag&&(f.q=Ge(c.n),f.t=b.tag);f.h=b.Ad();a.Ia("q",f,function(f){var k=f.d,m=f.s;if(k&&"object"===typeof k&&y(k,"w")){var l=z(k,"w");da(l)&&0<=La(l,"no_index")&&S("Using an unspecified index. Consider adding "+('".indexOn": "'+c.n.g.toString()+'"')+" at "+c.path.toString()+" to your security rules for better performance")}(a.ba[d]&&a.ba[d][e])===b&&(a.f("listen response",f),"ok"!==m&&Wh(a,d,e),b.I&&
b.I(m,k))})}h.O=function(a,b,c){this.Ca={rg:a,sf:!1,Dc:b,od:c};this.f("Authenticating using credential: "+a);Xh(this);(b=40==a.length)||(a=Cd(a).Ec,b="object"===typeof a&&!0===z(a,"admin"));b&&(this.f("Admin auth credential detected.  Reducing max reconnect time."),this.Id=3E4)};h.je=function(a){this.Ca=null;this.qa&&this.Ia("unauth",{},function(b){a(b.s,b.d)})};
function Xh(a){var b=a.Ca;a.qa&&b&&a.Ia("auth",{cred:b.rg},function(c){var d=c.s;c=c.d||"error";"ok"!==d&&a.Ca===b&&(a.Ca=null);b.sf?"ok"!==d&&b.od&&b.od(d,c):(b.sf=!0,b.Dc&&b.Dc(d,c))})}h.$f=function(a,b){var c=a.path.toString(),d=a.wa();this.f("Unlisten called for "+c+" "+d);O(Ie(a.n)||!He(a.n),"unlisten() called for non-default but complete query");if(Wh(this,c,d)&&this.qa){var e=Ge(a.n);this.f("Unlisten on "+c+" for "+d);c={p:c};b&&(c.q=e,c.t=b);this.Ia("n",c)}};
h.Qe=function(a,b,c){this.qa?Yh(this,"o",a,b,c):this.Yc.push({bd:a,action:"o",data:b,I:c})};h.Gf=function(a,b,c){this.qa?Yh(this,"om",a,b,c):this.Yc.push({bd:a,action:"om",data:b,I:c})};h.Md=function(a,b){this.qa?Yh(this,"oc",a,null,b):this.Yc.push({bd:a,action:"oc",data:null,I:b})};function Yh(a,b,c,d,e){c={p:c,d:d};a.f("onDisconnect "+b,c);a.Ia(b,c,function(a){e&&setTimeout(function(){e(a.s,a.d)},Math.floor(0))})}h.put=function(a,b,c,d){Zh(this,"p",a,b,c,d)};
h.Df=function(a,b,c,d){Zh(this,"m",a,b,c,d)};function Zh(a,b,c,d,e,f){d={p:c,d:d};p(f)&&(d.h=f);a.sa.push({action:b,Pf:d,I:e});a.ad++;b=a.sa.length-1;a.qa?$h(a,b):a.f("Buffering put: "+c)}function $h(a,b){var c=a.sa[b].action,d=a.sa[b].Pf,e=a.sa[b].I;a.sa[b].Ug=a.qa;a.Ia(c,d,function(d){a.f(c+" response",d);delete a.sa[b];a.ad--;0===a.ad&&(a.sa=[]);e&&e(d.s,d.d)})}
h.Ye=function(a){this.qa&&(a={c:a},this.f("reportStats",a),this.Ia("s",a,function(a){"ok"!==a.s&&this.f("reportStats","Error sending stats: "+a.d)}))};
h.Ld=function(a){if("r"in a){this.f("from server: "+G(a));var b=a.r,c=this.Wd[b];c&&(delete this.Wd[b],c(a.b))}else{if("error"in a)throw"A server-side error has occurred: "+a.error;"a"in a&&(b=a.a,c=a.b,this.f("handleServerMessage",b,c),"d"===b?this.Kb(c.p,c.d,!1,c.t):"m"===b?this.Kb(c.p,c.d,!0,c.t):"c"===b?ai(this,c.p,c.q):"ac"===b?(a=c.s,b=c.d,c=this.Ca,this.Ca=null,c&&c.od&&c.od(a,b)):"sd"===b?this.$e?this.$e(c):"msg"in c&&"undefined"!==typeof console&&console.log("FIREBASE: "+c.msg.replace("\n",
"\nFIREBASE: ")):qd("Unrecognized action received from server: "+G(b)+"\nAre you using the latest client?"))}};h.Zc=function(a,b){this.f("connection ready");this.qa=!0;this.Oc=(new Date).getTime();this.Se({serverTimeOffset:a-(new Date).getTime()});this.Fb=b;if(this.rf){var c={};c["sdk.js."+Eb.replace(/\./g,"-")]=1;Dg()?c["framework.cordova"]=1:"object"===typeof navigator&&"ReactNative"===navigator.product&&(c["framework.reactnative"]=1);this.Ye(c)}bi(this);this.rf=!1;this.Xc(!0)};
function Th(a,b){O(!a.Ma,"Scheduling a connect when we're already connected/ing?");a.wb&&clearTimeout(a.wb);a.wb=setTimeout(function(){a.wb=null;ci(a)},Math.floor(b))}h.Ng=function(a){a&&!this.Sb&&this.eb===this.Id&&(this.f("Window became visible.  Reducing delay."),this.eb=1E3,this.Ma||Th(this,0));this.Sb=a};h.Lg=function(a){a?(this.f("Browser went online."),this.eb=1E3,this.Ma||Th(this,0)):(this.f("Browser went offline.  Killing connection."),this.Ma&&this.Ma.close())};
h.If=function(){this.f("data client disconnected");this.qa=!1;this.Ma=null;for(var a=0;a<this.sa.length;a++){var b=this.sa[a];b&&"h"in b.Pf&&b.Ug&&(b.I&&b.I("disconnect"),delete this.sa[a],this.ad--)}0===this.ad&&(this.sa=[]);this.Wd={};di(this)&&(this.Sb?this.Oc&&(3E4<(new Date).getTime()-this.Oc&&(this.eb=1E3),this.Oc=null):(this.f("Window isn't visible.  Delaying reconnect."),this.eb=this.Id,this.Ke=(new Date).getTime()),a=Math.max(0,this.eb-((new Date).getTime()-this.Ke)),a*=Math.random(),this.f("Trying to reconnect in "+
a+"ms"),Th(this,a),this.eb=Math.min(this.Id,1.3*this.eb));this.Xc(!1)};function ci(a){if(di(a)){a.f("Making a connection attempt");a.Ke=(new Date).getTime();a.Oc=null;var b=u(a.Ld,a),c=u(a.Zc,a),d=u(a.If,a),e=a.id+":"+Uh++;a.Ma=new Fh(e,a.G,b,c,d,function(b){S(b+" ("+a.G.toString()+")");a.Bf=!0},a.Fb)}}h.Cb=function(){this.Ie=!0;this.Ma?this.Ma.close():(this.wb&&(clearTimeout(this.wb),this.wb=null),this.qa&&this.If())};h.vc=function(){this.Ie=!1;this.eb=1E3;this.Ma||Th(this,0)};
function ai(a,b,c){c=c?Oa(c,function(a){return xd(a)}).join("$"):"default";(a=Wh(a,b,c))&&a.I&&a.I("permission_denied")}function Wh(a,b,c){b=(new P(b)).toString();var d;p(a.ba[b])?(d=a.ba[b][c],delete a.ba[b][c],0===oa(a.ba[b])&&delete a.ba[b]):d=void 0;return d}function bi(a){Xh(a);v(a.ba,function(b){v(b,function(b){Vh(a,b)})});for(var b=0;b<a.sa.length;b++)a.sa[b]&&$h(a,b);for(;a.Yc.length;)b=a.Yc.shift(),Yh(a,b.action,b.bd,b.data,b.I)}function di(a){var b;b=jf.yb().oc;return!a.Bf&&!a.Ie&&b};var U={zg:function(){oh=xh=!0}};U.forceLongPolling=U.zg;U.Ag=function(){ph=!0};U.forceWebSockets=U.Ag;U.$g=function(a,b){a.k.Va.$e=b};U.setSecurityDebugCallback=U.$g;U.bf=function(a,b){a.k.bf(b)};U.stats=U.bf;U.cf=function(a,b){a.k.cf(b)};U.statsIncrementCounter=U.cf;U.ud=function(a){return a.k.ud};U.dataUpdateCount=U.ud;U.Dg=function(a,b){a.k.He=b};U.interceptServerData=U.Dg;U.Jg=function(a){new Og(a)};U.onPopupOpen=U.Jg;U.Yg=function(a){xg=a};U.setAuthenticationServer=U.Yg;function ei(a,b){this.committed=a;this.snapshot=b};function V(a,b){this.dd=a;this.ta=b}V.prototype.cancel=function(a){D("Firebase.onDisconnect().cancel",0,1,arguments.length);F("Firebase.onDisconnect().cancel",1,a,!0);var b=new B;this.dd.Md(this.ta,C(b,a));return b.D};V.prototype.cancel=V.prototype.cancel;V.prototype.remove=function(a){D("Firebase.onDisconnect().remove",0,1,arguments.length);og("Firebase.onDisconnect().remove",this.ta);F("Firebase.onDisconnect().remove",1,a,!0);var b=new B;fi(this.dd,this.ta,null,C(b,a));return b.D};
V.prototype.remove=V.prototype.remove;V.prototype.set=function(a,b){D("Firebase.onDisconnect().set",1,2,arguments.length);og("Firebase.onDisconnect().set",this.ta);gg("Firebase.onDisconnect().set",a,this.ta,!1);F("Firebase.onDisconnect().set",2,b,!0);var c=new B;fi(this.dd,this.ta,a,C(c,b));return c.D};V.prototype.set=V.prototype.set;
V.prototype.Ob=function(a,b,c){D("Firebase.onDisconnect().setWithPriority",2,3,arguments.length);og("Firebase.onDisconnect().setWithPriority",this.ta);gg("Firebase.onDisconnect().setWithPriority",a,this.ta,!1);kg("Firebase.onDisconnect().setWithPriority",2,b);F("Firebase.onDisconnect().setWithPriority",3,c,!0);var d=new B;gi(this.dd,this.ta,a,b,C(d,c));return d.D};V.prototype.setWithPriority=V.prototype.Ob;
V.prototype.update=function(a,b){D("Firebase.onDisconnect().update",1,2,arguments.length);og("Firebase.onDisconnect().update",this.ta);if(da(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;S("Passing an Array to Firebase.onDisconnect().update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}jg("Firebase.onDisconnect().update",a,this.ta);F("Firebase.onDisconnect().update",2,b,!0);
c=new B;hi(this.dd,this.ta,a,C(c,b));return c.D};V.prototype.update=V.prototype.update;function W(a,b,c){this.A=a;this.Y=b;this.g=c}W.prototype.J=function(){D("Firebase.DataSnapshot.val",0,0,arguments.length);return this.A.J()};W.prototype.val=W.prototype.J;W.prototype.qf=function(){D("Firebase.DataSnapshot.exportVal",0,0,arguments.length);return this.A.J(!0)};W.prototype.exportVal=W.prototype.qf;W.prototype.xg=function(){D("Firebase.DataSnapshot.exists",0,0,arguments.length);return!this.A.e()};W.prototype.exists=W.prototype.xg;
W.prototype.o=function(a){D("Firebase.DataSnapshot.child",0,1,arguments.length);fa(a)&&(a=String(a));ng("Firebase.DataSnapshot.child",a);var b=new P(a),c=this.Y.o(b);return new W(this.A.S(b),c,R)};W.prototype.child=W.prototype.o;W.prototype.Fa=function(a){D("Firebase.DataSnapshot.hasChild",1,1,arguments.length);ng("Firebase.DataSnapshot.hasChild",a);var b=new P(a);return!this.A.S(b).e()};W.prototype.hasChild=W.prototype.Fa;
W.prototype.C=function(){D("Firebase.DataSnapshot.getPriority",0,0,arguments.length);return this.A.C().J()};W.prototype.getPriority=W.prototype.C;W.prototype.forEach=function(a){D("Firebase.DataSnapshot.forEach",1,1,arguments.length);F("Firebase.DataSnapshot.forEach",1,a,!1);if(this.A.L())return!1;var b=this;return!!this.A.R(this.g,function(c,d){return a(new W(d,b.Y.o(c),R))})};W.prototype.forEach=W.prototype.forEach;
W.prototype.zd=function(){D("Firebase.DataSnapshot.hasChildren",0,0,arguments.length);return this.A.L()?!1:!this.A.e()};W.prototype.hasChildren=W.prototype.zd;W.prototype.name=function(){S("Firebase.DataSnapshot.name() being deprecated. Please use Firebase.DataSnapshot.key() instead.");D("Firebase.DataSnapshot.name",0,0,arguments.length);return this.key()};W.prototype.name=W.prototype.name;W.prototype.key=function(){D("Firebase.DataSnapshot.key",0,0,arguments.length);return this.Y.key()};
W.prototype.key=W.prototype.key;W.prototype.Hb=function(){D("Firebase.DataSnapshot.numChildren",0,0,arguments.length);return this.A.Hb()};W.prototype.numChildren=W.prototype.Hb;W.prototype.Mb=function(){D("Firebase.DataSnapshot.ref",0,0,arguments.length);return this.Y};W.prototype.ref=W.prototype.Mb;function ii(a,b,c){this.Vb=a;this.tb=b;this.vb=c||null}h=ii.prototype;h.Qf=function(a){return"value"===a};h.createEvent=function(a,b){var c=b.n.g;return new jc("value",this,new W(a.Na,b.Mb(),c))};h.Zb=function(a){var b=this.vb;if("cancel"===a.De()){O(this.tb,"Raising a cancel event on a listener with no cancel callback");var c=this.tb;return function(){c.call(b,a.error)}}var d=this.Vb;return function(){d.call(b,a.be)}};h.lf=function(a,b){return this.tb?new kc(this,a,b):null};
h.matches=function(a){return a instanceof ii?a.Vb&&this.Vb?a.Vb===this.Vb&&a.vb===this.vb:!0:!1};h.yf=function(){return null!==this.Vb};function ji(a,b,c){this.ja=a;this.tb=b;this.vb=c}h=ji.prototype;h.Qf=function(a){a="children_added"===a?"child_added":a;return("children_removed"===a?"child_removed":a)in this.ja};h.lf=function(a,b){return this.tb?new kc(this,a,b):null};
h.createEvent=function(a,b){O(null!=a.Za,"Child events should have a childName.");var c=b.Mb().o(a.Za);return new jc(a.type,this,new W(a.Na,c,b.n.g),a.Td)};h.Zb=function(a){var b=this.vb;if("cancel"===a.De()){O(this.tb,"Raising a cancel event on a listener with no cancel callback");var c=this.tb;return function(){c.call(b,a.error)}}var d=this.ja[a.wd];return function(){d.call(b,a.be,a.Td)}};
h.matches=function(a){if(a instanceof ji){if(!this.ja||!a.ja)return!0;if(this.vb===a.vb){var b=oa(a.ja);if(b===oa(this.ja)){if(1===b){var b=pa(a.ja),c=pa(this.ja);return c===b&&(!a.ja[b]||!this.ja[c]||a.ja[b]===this.ja[c])}return na(this.ja,function(b,c){return a.ja[c]===b})}}}return!1};h.yf=function(){return null!==this.ja};function ki(){this.za={}}h=ki.prototype;h.e=function(){return va(this.za)};h.gb=function(a,b,c){var d=a.source.Lb;if(null!==d)return d=z(this.za,d),O(null!=d,"SyncTree gave us an op for an invalid query."),d.gb(a,b,c);var e=[];v(this.za,function(d){e=e.concat(d.gb(a,b,c))});return e};h.Tb=function(a,b,c,d,e){var f=a.wa(),g=z(this.za,f);if(!g){var g=c.Aa(e?d:null),k=!1;g?k=!0:(g=d instanceof fe?c.Cc(d):H,k=!1);g=new Ye(a,new je(new Xb(g,k,!1),new Xb(d,e,!1)));this.za[f]=g}g.Tb(b);return af(g,b)};
h.nb=function(a,b,c){var d=a.wa(),e=[],f=[],g=null!=li(this);if("default"===d){var k=this;v(this.za,function(a,d){f=f.concat(a.nb(b,c));a.e()&&(delete k.za[d],He(a.Y.n)||e.push(a.Y))})}else{var m=z(this.za,d);m&&(f=f.concat(m.nb(b,c)),m.e()&&(delete this.za[d],He(m.Y.n)||e.push(m.Y)))}g&&null==li(this)&&e.push(new X(a.k,a.path));return{Vg:e,vg:f}};function mi(a){return Na(qa(a.za),function(a){return!He(a.Y.n)})}h.kb=function(a){var b=null;v(this.za,function(c){b=b||c.kb(a)});return b};
function ni(a,b){if(He(b.n))return li(a);var c=b.wa();return z(a.za,c)}function li(a){return ua(a.za,function(a){return He(a.Y.n)})||null};function oi(a){this.va=qe;this.mb=new Pf;this.df={};this.qc={};this.Qc=a}function pi(a,b,c,d,e){var f=a.mb,g=e;O(d>f.Pc,"Stacking an older write on top of newer ones");p(g)||(g=!0);f.pa.push({path:b,Ja:c,md:d,visible:g});g&&(f.V=Jf(f.V,b,c));f.Pc=d;return e?qi(a,new Ac(Ef,b,c)):[]}function ri(a,b,c,d){var e=a.mb;O(d>e.Pc,"Stacking an older merge on top of newer ones");e.pa.push({path:b,children:c,md:d,visible:!0});e.V=Kf(e.V,b,c);e.Pc=d;c=sf(c);return qi(a,new bf(Ef,b,c))}
function si(a,b,c){c=c||!1;var d=Qf(a.mb,b);if(a.mb.Ud(b)){var e=qe;null!=d.Ja?e=e.set(M,!0):Fb(d.children,function(a,b){e=e.set(new P(a),b)});return qi(a,new Df(d.path,e,c))}return[]}function ti(a,b,c){c=sf(c);return qi(a,new bf(Gf,b,c))}function ui(a,b,c,d){d=vi(a,d);if(null!=d){var e=wi(d);d=e.path;e=e.Lb;b=lf(d,b);c=new Ac(new Ff(!1,!0,e,!0),b,c);return xi(a,d,c)}return[]}
function yi(a,b,c,d){if(d=vi(a,d)){var e=wi(d);d=e.path;e=e.Lb;b=lf(d,b);c=sf(c);c=new bf(new Ff(!1,!0,e,!0),b,c);return xi(a,d,c)}return[]}
oi.prototype.Tb=function(a,b){var c=a.path,d=null,e=!1;zf(this.va,c,function(a,b){var f=lf(a,c);d=d||b.kb(f);e=e||null!=li(b)});var f=this.va.get(c);f?(e=e||null!=li(f),d=d||f.kb(M)):(f=new ki,this.va=this.va.set(c,f));var g;null!=d?g=!0:(g=!1,d=H,Cf(this.va.subtree(c),function(a,b){var c=b.kb(M);c&&(d=d.W(a,c))}));var k=null!=ni(f,a);if(!k&&!He(a.n)){var m=zi(a);O(!(m in this.qc),"View does not exist, but we have a tag");var l=Ai++;this.qc[m]=l;this.df["_"+l]=m}g=f.Tb(a,b,new Uf(c,this.mb),d,g);
k||e||(f=ni(f,a),g=g.concat(Bi(this,a,f)));return g};
oi.prototype.nb=function(a,b,c){var d=a.path,e=this.va.get(d),f=[];if(e&&("default"===a.wa()||null!=ni(e,a))){f=e.nb(a,b,c);e.e()&&(this.va=this.va.remove(d));e=f.Vg;f=f.vg;b=-1!==Sa(e,function(a){return He(a.n)});var g=xf(this.va,d,function(a,b){return null!=li(b)});if(b&&!g&&(d=this.va.subtree(d),!d.e()))for(var d=Ci(d),k=0;k<d.length;++k){var m=d[k],l=m.Y,m=Di(this,m);this.Qc.af(Ei(l),Fi(this,l),m.Ad,m.I)}if(!g&&0<e.length&&!c)if(b)this.Qc.de(Ei(a),null);else{var t=this;Ma(e,function(a){a.wa();
var b=t.qc[zi(a)];t.Qc.de(Ei(a),b)})}Gi(this,e)}return f};oi.prototype.Aa=function(a,b){var c=this.mb,d=xf(this.va,a,function(b,c){var d=lf(b,a);if(d=c.kb(d))return d});return c.Aa(a,d,b,!0)};function Ci(a){return vf(a,function(a,c,d){if(c&&null!=li(c))return[li(c)];var e=[];c&&(e=mi(c));v(d,function(a){e=e.concat(a)});return e})}function Gi(a,b){for(var c=0;c<b.length;++c){var d=b[c];if(!He(d.n)){var d=zi(d),e=a.qc[d];delete a.qc[d];delete a.df["_"+e]}}}
function Ei(a){return He(a.n)&&!Ie(a.n)?a.Mb():a}function Bi(a,b,c){var d=b.path,e=Fi(a,b);c=Di(a,c);b=a.Qc.af(Ei(b),e,c.Ad,c.I);d=a.va.subtree(d);if(e)O(null==li(d.value),"If we're adding a query, it shouldn't be shadowed");else for(e=vf(d,function(a,b,c){if(!a.e()&&b&&null!=li(b))return[Ze(li(b))];var d=[];b&&(d=d.concat(Oa(mi(b),function(a){return a.Y})));v(c,function(a){d=d.concat(a)});return d}),d=0;d<e.length;++d)c=e[d],a.Qc.de(Ei(c),Fi(a,c));return b}
function Di(a,b){var c=b.Y,d=Fi(a,c);return{Ad:function(){return(b.w()||H).hash()},I:function(b){if("ok"===b){if(d){var f=c.path;if(b=vi(a,d)){var g=wi(b);b=g.path;g=g.Lb;f=lf(b,f);f=new Cc(new Ff(!1,!0,g,!0),f);b=xi(a,b,f)}else b=[]}else b=qi(a,new Cc(Gf,c.path));return b}f="Unknown Error";"too_big"===b?f="The data requested exceeds the maximum size that can be accessed with a single request.":"permission_denied"==b?f="Client doesn't have permission to access the desired data.":"unavailable"==b&&
(f="The service is unavailable");f=Error(b+" at "+c.path.toString()+": "+f);f.code=b.toUpperCase();return a.nb(c,null,f)}}}function zi(a){return a.path.toString()+"$"+a.wa()}function wi(a){var b=a.indexOf("$");O(-1!==b&&b<a.length-1,"Bad queryKey.");return{Lb:a.substr(b+1),path:new P(a.substr(0,b))}}function vi(a,b){var c=a.df,d="_"+b;return d in c?c[d]:void 0}function Fi(a,b){var c=zi(b);return z(a.qc,c)}var Ai=1;
function xi(a,b,c){var d=a.va.get(b);O(d,"Missing sync point for query tag that we're tracking");return d.gb(c,new Uf(b,a.mb),null)}function qi(a,b){return Hi(a,b,a.va,null,new Uf(M,a.mb))}function Hi(a,b,c,d,e){if(b.path.e())return Ii(a,b,c,d,e);var f=c.get(M);null==d&&null!=f&&(d=f.kb(M));var g=[],k=K(b.path),m=b.$c(k);if((c=c.children.get(k))&&m)var l=d?d.T(k):null,k=e.o(k),g=g.concat(Hi(a,m,c,l,k));f&&(g=g.concat(f.gb(b,e,d)));return g}
function Ii(a,b,c,d,e){var f=c.get(M);null==d&&null!=f&&(d=f.kb(M));var g=[];c.children.ka(function(c,f){var l=d?d.T(c):null,t=e.o(c),A=b.$c(c);A&&(g=g.concat(Ii(a,A,f,l,t)))});f&&(g=g.concat(f.gb(b,e,d)));return g};function Ji(a,b){this.G=a;this.Xa=uc(a);this.hd=null;this.fa=new Zb;this.Kd=1;this.Va=null;b||0<=("object"===typeof window&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i)?(this.da=new cf(this.G,u(this.Kb,this)),setTimeout(u(this.Xc,this,!0),0)):this.da=this.Va=new Rh(this.G,u(this.Kb,this),u(this.Xc,this),u(this.Se,this));this.dh=vc(a,u(function(){return new pc(this.Xa,this.da)},this));this.yc=new Wf;
this.Ge=new Sb;var c=this;this.Fd=new oi({af:function(a,b,f,g){b=[];f=c.Ge.j(a.path);f.e()||(b=qi(c.Fd,new Ac(Gf,a.path,f)),setTimeout(function(){g("ok")},0));return b},de:aa});Ki(this,"connected",!1);this.na=new Vc;this.O=new Yg(a,u(this.da.O,this.da),u(this.da.je,this.da),u(this.Pe,this));this.ud=0;this.He=null;this.M=new oi({af:function(a,b,f,g){c.da.Cf(a,f,b,function(b,e){var f=g(b,e);dc(c.fa,a.path,f)});return[]},de:function(a,b){c.da.$f(a,b)}})}h=Ji.prototype;
h.toString=function(){return(this.G.ob?"https://":"http://")+this.G.host};h.name=function(){return this.G.lc};function Li(a){a=a.Ge.j(new P(".info/serverTimeOffset")).J()||0;return(new Date).getTime()+a}function Mi(a){a=a={timestamp:Li(a)};a.timestamp=a.timestamp||(new Date).getTime();return a}
h.Kb=function(a,b,c,d){this.ud++;var e=new P(a);b=this.He?this.He(a,b):b;a=[];d?c?(b=ma(b,function(a){return Q(a)}),a=yi(this.M,e,b,d)):(b=Q(b),a=ui(this.M,e,b,d)):c?(d=ma(b,function(a){return Q(a)}),a=ti(this.M,e,d)):(d=Q(b),a=qi(this.M,new Ac(Gf,e,d)));d=e;0<a.length&&(d=Ni(this,e));dc(this.fa,d,a)};h.Xc=function(a){Ki(this,"connected",a);!1===a&&Oi(this)};h.Se=function(a){var b=this;zd(a,function(a,d){Ki(b,d,a)})};h.Pe=function(a){Ki(this,"authenticated",a)};
function Ki(a,b,c){b=new P("/.info/"+b);c=Q(c);var d=a.Ge;d.Zd=d.Zd.H(b,c);c=qi(a.Fd,new Ac(Gf,b,c));dc(a.fa,b,c)}h.Ob=function(a,b,c,d){this.f("set",{path:a.toString(),value:b,mh:c});var e=Mi(this);b=Q(b,c);var e=Xc(b,e),f=this.Kd++,e=pi(this.M,a,e,f,!0);$b(this.fa,e);var g=this;this.da.put(a.toString(),b.J(!0),function(b,c){var e="ok"===b;e||S("set at "+a+" failed: "+b);e=si(g.M,f,!e);dc(g.fa,a,e);Pi(d,b,c)});e=Qi(this,a);Ni(this,e);dc(this.fa,e,[])};
h.update=function(a,b,c){this.f("update",{path:a.toString(),value:b});var d=!0,e=Mi(this),f={};v(b,function(a,b){d=!1;var c=Q(a);f[b]=Xc(c,e)});if(d)fc("update() called with empty data.  Don't do anything."),Pi(c,"ok");else{var g=this.Kd++,k=ri(this.M,a,f,g);$b(this.fa,k);var m=this;this.da.Df(a.toString(),b,function(b,d){var e="ok"===b;e||S("update at "+a+" failed: "+b);var e=si(m.M,g,!e),f=a;0<e.length&&(f=Ni(m,a));dc(m.fa,f,e);Pi(c,b,d)});b=Qi(this,a);Ni(this,b);dc(this.fa,a,[])}};
function Oi(a){a.f("onDisconnectEvents");var b=Mi(a),c=[];Wc(Uc(a.na,b),M,function(b,e){c=c.concat(qi(a.M,new Ac(Gf,b,e)));var f=Qi(a,b);Ni(a,f)});a.na=new Vc;dc(a.fa,M,c)}h.Md=function(a,b){var c=this;this.da.Md(a.toString(),function(d,e){"ok"===d&&wg(c.na,a);Pi(b,d,e)})};function fi(a,b,c,d){var e=Q(c);a.da.Qe(b.toString(),e.J(!0),function(c,g){"ok"===c&&a.na.rc(b,e);Pi(d,c,g)})}function gi(a,b,c,d,e){var f=Q(c,d);a.da.Qe(b.toString(),f.J(!0),function(c,d){"ok"===c&&a.na.rc(b,f);Pi(e,c,d)})}
function hi(a,b,c,d){var e=!0,f;for(f in c)e=!1;e?(fc("onDisconnect().update() called with empty data.  Don't do anything."),Pi(d,"ok")):a.da.Gf(b.toString(),c,function(e,f){if("ok"===e)for(var m in c){var l=Q(c[m]);a.na.rc(b.o(m),l)}Pi(d,e,f)})}function Ri(a,b,c){c=".info"===K(b.path)?a.Fd.Tb(b,c):a.M.Tb(b,c);bc(a.fa,b.path,c)}h.Cb=function(){this.Va&&this.Va.Cb()};h.vc=function(){this.Va&&this.Va.vc()};
h.bf=function(a){if("undefined"!==typeof console){a?(this.hd||(this.hd=new oc(this.Xa)),a=this.hd.get()):a=this.Xa.get();var b=Pa(ra(a),function(a,b){return Math.max(b.length,a)},0),c;for(c in a){for(var d=a[c],e=c.length;e<b+2;e++)c+=" ";console.log(c+d)}}};h.cf=function(a){rc(this.Xa,a);this.dh.Vf[a]=!0};h.f=function(a){var b="";this.Va&&(b=this.Va.id+":");fc(b,arguments)};
function Pi(a,b,c){a&&gc(function(){if("ok"==b)a(null);else{var d=(b||"error").toUpperCase(),e=d;c&&(e+=": "+c);e=Error(e);e.code=d;a(e)}})};function Si(a,b,c,d,e){function f(){}a.f("transaction on "+b);var g=new X(a,b);g.Ib("value",f);c={path:b,update:c,I:d,status:null,Lf:id(),gf:e,Sf:0,le:function(){g.mc("value",f)},ne:null,Da:null,rd:null,sd:null,td:null};d=a.M.Aa(b,void 0)||H;c.rd=d;d=c.update(d.J());if(p(d)){hg("transaction failed: Data returned ",d,c.path);c.status=1;e=Xf(a.yc,b);var k=e.Ea()||[];k.push(c);Yf(e,k);"object"===typeof d&&null!==d&&y(d,".priority")?(k=z(d,".priority"),O(fg(k),"Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")):
k=(a.M.Aa(b)||H).C().J();e=Mi(a);d=Q(d,k);e=Xc(d,e);c.sd=d;c.td=e;c.Da=a.Kd++;c=pi(a.M,b,e,c.Da,c.gf);dc(a.fa,b,c);Ti(a)}else c.le(),c.sd=null,c.td=null,c.I&&(a=new W(c.rd,new X(a,c.path),R),c.I(null,!1,a))}function Ti(a,b){var c=b||a.yc;b||Ui(a,c);if(null!==c.Ea()){var d=Vi(a,c);O(0<d.length,"Sending zero length transaction queue");Qa(d,function(a){return 1===a.status})&&Wi(a,c.path(),d)}else c.zd()&&c.R(function(b){Ti(a,b)})}
function Wi(a,b,c){for(var d=Oa(c,function(a){return a.Da}),e=a.M.Aa(b,d)||H,d=e,e=e.hash(),f=0;f<c.length;f++){var g=c[f];O(1===g.status,"tryToSendTransactionQueue_: items in queue should all be run.");g.status=2;g.Sf++;var k=lf(b,g.path),d=d.H(k,g.sd)}d=d.J(!0);a.da.put(b.toString(),d,function(d){a.f("transaction put response",{path:b.toString(),status:d});var e=[];if("ok"===d){d=[];for(f=0;f<c.length;f++){c[f].status=3;e=e.concat(si(a.M,c[f].Da));if(c[f].I){var g=c[f].td,k=new X(a,c[f].path);d.push(u(c[f].I,
null,null,!0,new W(g,k,R)))}c[f].le()}Ui(a,Xf(a.yc,b));Ti(a);dc(a.fa,b,e);for(f=0;f<d.length;f++)gc(d[f])}else{if("datastale"===d)for(f=0;f<c.length;f++)c[f].status=4===c[f].status?5:1;else for(S("transaction at "+b.toString()+" failed: "+d),f=0;f<c.length;f++)c[f].status=5,c[f].ne=d;Ni(a,b)}},e)}function Ni(a,b){var c=Xi(a,b),d=c.path(),c=Vi(a,c);Yi(a,c,d);return d}
function Yi(a,b,c){if(0!==b.length){for(var d=[],e=[],f=Oa(b,function(a){return a.Da}),g=0;g<b.length;g++){var k=b[g],m=lf(c,k.path),l=!1,t;O(null!==m,"rerunTransactionsUnderNode_: relativePath should not be null.");if(5===k.status)l=!0,t=k.ne,e=e.concat(si(a.M,k.Da,!0));else if(1===k.status)if(25<=k.Sf)l=!0,t="maxretry",e=e.concat(si(a.M,k.Da,!0));else{var A=a.M.Aa(k.path,f)||H;k.rd=A;var I=b[g].update(A.J());p(I)?(hg("transaction failed: Data returned ",I,k.path),m=Q(I),"object"===typeof I&&null!=
I&&y(I,".priority")||(m=m.ia(A.C())),A=k.Da,I=Mi(a),I=Xc(m,I),k.sd=m,k.td=I,k.Da=a.Kd++,Ta(f,A),e=e.concat(pi(a.M,k.path,I,k.Da,k.gf)),e=e.concat(si(a.M,A,!0))):(l=!0,t="nodata",e=e.concat(si(a.M,k.Da,!0)))}dc(a.fa,c,e);e=[];l&&(b[g].status=3,setTimeout(b[g].le,Math.floor(0)),b[g].I&&("nodata"===t?(k=new X(a,b[g].path),d.push(u(b[g].I,null,null,!1,new W(b[g].rd,k,R)))):d.push(u(b[g].I,null,Error(t),!1,null))))}Ui(a,a.yc);for(g=0;g<d.length;g++)gc(d[g]);Ti(a)}}
function Xi(a,b){for(var c,d=a.yc;null!==(c=K(b))&&null===d.Ea();)d=Xf(d,c),b=N(b);return d}function Vi(a,b){var c=[];Zi(a,b,c);c.sort(function(a,b){return a.Lf-b.Lf});return c}function Zi(a,b,c){var d=b.Ea();if(null!==d)for(var e=0;e<d.length;e++)c.push(d[e]);b.R(function(b){Zi(a,b,c)})}function Ui(a,b){var c=b.Ea();if(c){for(var d=0,e=0;e<c.length;e++)3!==c[e].status&&(c[d]=c[e],d++);c.length=d;Yf(b,0<c.length?c:null)}b.R(function(b){Ui(a,b)})}
function Qi(a,b){var c=Xi(a,b).path(),d=Xf(a.yc,b);ag(d,function(b){$i(a,b)});$i(a,d);$f(d,function(b){$i(a,b)});return c}
function $i(a,b){var c=b.Ea();if(null!==c){for(var d=[],e=[],f=-1,g=0;g<c.length;g++)4!==c[g].status&&(2===c[g].status?(O(f===g-1,"All SENT items should be at beginning of queue."),f=g,c[g].status=4,c[g].ne="set"):(O(1===c[g].status,"Unexpected transaction status in abort"),c[g].le(),e=e.concat(si(a.M,c[g].Da,!0)),c[g].I&&d.push(u(c[g].I,null,Error("set"),!1,null))));-1===f?Yf(b,null):c.length=f+1;dc(a.fa,b.path(),e);for(g=0;g<d.length;g++)gc(d[g])}};function aj(){this.sc={};this.ag=!1}aj.prototype.Cb=function(){for(var a in this.sc)this.sc[a].Cb()};aj.prototype.vc=function(){for(var a in this.sc)this.sc[a].vc()};aj.prototype.ze=function(){this.ag=!0};ba(aj);aj.prototype.interrupt=aj.prototype.Cb;aj.prototype.resume=aj.prototype.vc;function Y(a,b,c,d){this.k=a;this.path=b;this.n=c;this.pc=d}
function bj(a){var b=null,c=null;a.oa&&(b=Od(a));a.ra&&(c=Rd(a));if(a.g===re){if(a.oa){if("[MIN_NAME]"!=Nd(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==typeof b)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}if(a.ra){if("[MAX_NAME]"!=Pd(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==
typeof c)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}}else if(a.g===R){if(null!=b&&!fg(b)||null!=c&&!fg(c))throw Error("Query: When ordering by priority, the first argument passed to startAt(), endAt(), or equalTo() must be a valid priority value (null, a number, or a string).");}else if(O(a.g instanceof ve||a.g===Be,"unknown index type."),null!=b&&"object"===typeof b||null!=c&&"object"===typeof c)throw Error("Query: First argument passed to startAt(), endAt(), or equalTo() cannot be an object.");
}function cj(a){if(a.oa&&a.ra&&a.la&&(!a.la||""===a.Rb))throw Error("Query: Can't combine startAt(), endAt(), and limit(). Use limitToFirst() or limitToLast() instead.");}function dj(a,b){if(!0===a.pc)throw Error(b+": You can't combine multiple orderBy calls.");}h=Y.prototype;h.Mb=function(){D("Query.ref",0,0,arguments.length);return new X(this.k,this.path)};
h.Ib=function(a,b,c,d){D("Query.on",2,4,arguments.length);lg("Query.on",a,!1);F("Query.on",2,b,!1);var e=ej("Query.on",c,d);if("value"===a)Ri(this.k,this,new ii(b,e.cancel||null,e.Qa||null));else{var f={};f[a]=b;Ri(this.k,this,new ji(f,e.cancel,e.Qa))}return b};
h.mc=function(a,b,c){D("Query.off",0,3,arguments.length);lg("Query.off",a,!0);F("Query.off",2,b,!0);Qb("Query.off",3,c);var d=null,e=null;"value"===a?d=new ii(b||null,null,c||null):a&&(b&&(e={},e[a]=b),d=new ji(e,null,c||null));e=this.k;d=".info"===K(this.path)?e.Fd.nb(this,d):e.M.nb(this,d);bc(e.fa,this.path,d)};
h.Og=function(a,b){function c(k){f&&(f=!1,e.mc(a,c),b&&b.call(d.Qa,k),g.resolve(k))}D("Query.once",1,4,arguments.length);lg("Query.once",a,!1);F("Query.once",2,b,!0);var d=ej("Query.once",arguments[2],arguments[3]),e=this,f=!0,g=new B;Nb(g.D);this.Ib(a,c,function(b){e.mc(a,c);d.cancel&&d.cancel.call(d.Qa,b);g.reject(b)});return g.D};
h.Le=function(a){S("Query.limit() being deprecated. Please use Query.limitToFirst() or Query.limitToLast() instead.");D("Query.limit",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limit: First argument must be a positive integer.");if(this.n.la)throw Error("Query.limit: Limit was already set (by another call to limit, limitToFirst, orlimitToLast.");var b=this.n.Le(a);cj(b);return new Y(this.k,this.path,b,this.pc)};
h.Me=function(a){D("Query.limitToFirst",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToFirst: First argument must be a positive integer.");if(this.n.la)throw Error("Query.limitToFirst: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new Y(this.k,this.path,this.n.Me(a),this.pc)};
h.Ne=function(a){D("Query.limitToLast",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToLast: First argument must be a positive integer.");if(this.n.la)throw Error("Query.limitToLast: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new Y(this.k,this.path,this.n.Ne(a),this.pc)};
h.Pg=function(a){D("Query.orderByChild",1,1,arguments.length);if("$key"===a)throw Error('Query.orderByChild: "$key" is invalid.  Use Query.orderByKey() instead.');if("$priority"===a)throw Error('Query.orderByChild: "$priority" is invalid.  Use Query.orderByPriority() instead.');if("$value"===a)throw Error('Query.orderByChild: "$value" is invalid.  Use Query.orderByValue() instead.');ng("Query.orderByChild",a);dj(this,"Query.orderByChild");var b=new P(a);if(b.e())throw Error("Query.orderByChild: cannot pass in empty path.  Use Query.orderByValue() instead.");
b=new ve(b);b=Fe(this.n,b);bj(b);return new Y(this.k,this.path,b,!0)};h.Qg=function(){D("Query.orderByKey",0,0,arguments.length);dj(this,"Query.orderByKey");var a=Fe(this.n,re);bj(a);return new Y(this.k,this.path,a,!0)};h.Rg=function(){D("Query.orderByPriority",0,0,arguments.length);dj(this,"Query.orderByPriority");var a=Fe(this.n,R);bj(a);return new Y(this.k,this.path,a,!0)};
h.Sg=function(){D("Query.orderByValue",0,0,arguments.length);dj(this,"Query.orderByValue");var a=Fe(this.n,Be);bj(a);return new Y(this.k,this.path,a,!0)};h.ce=function(a,b){D("Query.startAt",0,2,arguments.length);gg("Query.startAt",a,this.path,!0);mg("Query.startAt",b);var c=this.n.ce(a,b);cj(c);bj(c);if(this.n.oa)throw Error("Query.startAt: Starting point was already set (by another call to startAt or equalTo).");p(a)||(b=a=null);return new Y(this.k,this.path,c,this.pc)};
h.vd=function(a,b){D("Query.endAt",0,2,arguments.length);gg("Query.endAt",a,this.path,!0);mg("Query.endAt",b);var c=this.n.vd(a,b);cj(c);bj(c);if(this.n.ra)throw Error("Query.endAt: Ending point was already set (by another call to endAt or equalTo).");return new Y(this.k,this.path,c,this.pc)};
h.tg=function(a,b){D("Query.equalTo",1,2,arguments.length);gg("Query.equalTo",a,this.path,!1);mg("Query.equalTo",b);if(this.n.oa)throw Error("Query.equalTo: Starting point was already set (by another call to endAt or equalTo).");if(this.n.ra)throw Error("Query.equalTo: Ending point was already set (by another call to endAt or equalTo).");return this.ce(a,b).vd(a,b)};
h.toString=function(){D("Query.toString",0,0,arguments.length);for(var a=this.path,b="",c=a.aa;c<a.u.length;c++)""!==a.u[c]&&(b+="/"+encodeURIComponent(String(a.u[c])));return this.k.toString()+(b||"/")};h.wa=function(){var a=xd(Ge(this.n));return"{}"===a?"default":a};
function ej(a,b,c){var d={cancel:null,Qa:null};if(b&&c)d.cancel=b,F(a,3,d.cancel,!0),d.Qa=c,Qb(a,4,d.Qa);else if(b)if("object"===typeof b&&null!==b)d.Qa=b;else if("function"===typeof b)d.cancel=b;else throw Error(E(a,3,!0)+" must either be a cancel callback or a context object.");return d}Y.prototype.ref=Y.prototype.Mb;Y.prototype.on=Y.prototype.Ib;Y.prototype.off=Y.prototype.mc;Y.prototype.once=Y.prototype.Og;Y.prototype.limit=Y.prototype.Le;Y.prototype.limitToFirst=Y.prototype.Me;
Y.prototype.limitToLast=Y.prototype.Ne;Y.prototype.orderByChild=Y.prototype.Pg;Y.prototype.orderByKey=Y.prototype.Qg;Y.prototype.orderByPriority=Y.prototype.Rg;Y.prototype.orderByValue=Y.prototype.Sg;Y.prototype.startAt=Y.prototype.ce;Y.prototype.endAt=Y.prototype.vd;Y.prototype.equalTo=Y.prototype.tg;Y.prototype.toString=Y.prototype.toString;var Z={};Z.zc=Rh;Z.DataConnection=Z.zc;Rh.prototype.bh=function(a,b){this.Ia("q",{p:a},b)};Z.zc.prototype.simpleListen=Z.zc.prototype.bh;Rh.prototype.sg=function(a,b){this.Ia("echo",{d:a},b)};Z.zc.prototype.echo=Z.zc.prototype.sg;Rh.prototype.interrupt=Rh.prototype.Cb;Z.dg=Fh;Z.RealTimeConnection=Z.dg;Fh.prototype.sendRequest=Fh.prototype.Ia;Fh.prototype.close=Fh.prototype.close;
Z.Cg=function(a){var b=Rh.prototype.put;Rh.prototype.put=function(c,d,e,f){p(f)&&(f=a());b.call(this,c,d,e,f)};return function(){Rh.prototype.put=b}};Z.hijackHash=Z.Cg;Z.cg=dd;Z.ConnectionTarget=Z.cg;Z.wa=function(a){return a.wa()};Z.queryIdentifier=Z.wa;Z.Eg=function(a){return a.k.Va.ba};Z.listens=Z.Eg;Z.ze=function(a){a.ze()};Z.forceRestClient=Z.ze;function X(a,b){var c,d,e;if(a instanceof Ji)c=a,d=b;else{D("new Firebase",1,2,arguments.length);d=sd(arguments[0]);c=d.eh;"firebase"===d.domain&&rd(d.host+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead");c&&"undefined"!=c||rd("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com");d.ob||"undefined"!==typeof window&&window.location&&window.location.protocol&&-1!==window.location.protocol.indexOf("https:")&&S("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().");
c=new dd(d.host,d.ob,c,"ws"===d.scheme||"wss"===d.scheme);d=new P(d.bd);e=d.toString();var f;!(f=!q(c.host)||0===c.host.length||!eg(c.lc))&&(f=0!==e.length)&&(e&&(e=e.replace(/^\/*\.info(\/|$)/,"/")),f=!(q(e)&&0!==e.length&&!cg.test(e)));if(f)throw Error(E("new Firebase",1,!1)+'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".');if(b)if(b instanceof aj)e=b;else if(q(b))e=aj.yb(),c.Rd=b;else throw Error("Expected a valid Firebase.Context for second argument to new Firebase()");
else e=aj.yb();f=c.toString();var g=z(e.sc,f);g||(g=new Ji(c,e.ag),e.sc[f]=g);c=g}Y.call(this,c,d,De,!1);this.then=void 0;this["catch"]=void 0}ka(X,Y);var fj=X,gj=["Firebase"],hj=n;gj[0]in hj||!hj.execScript||hj.execScript("var "+gj[0]);for(var ij;gj.length&&(ij=gj.shift());)!gj.length&&p(fj)?hj[ij]=fj:hj=hj[ij]?hj[ij]:hj[ij]={};X.goOffline=function(){D("Firebase.goOffline",0,0,arguments.length);aj.yb().Cb()};X.goOnline=function(){D("Firebase.goOnline",0,0,arguments.length);aj.yb().vc()};
X.enableLogging=od;X.ServerValue={TIMESTAMP:{".sv":"timestamp"}};X.SDK_VERSION=Eb;X.INTERNAL=U;X.Context=aj;X.TEST_ACCESS=Z;X.prototype.name=function(){S("Firebase.name() being deprecated. Please use Firebase.key() instead.");D("Firebase.name",0,0,arguments.length);return this.key()};X.prototype.name=X.prototype.name;X.prototype.key=function(){D("Firebase.key",0,0,arguments.length);return this.path.e()?null:me(this.path)};X.prototype.key=X.prototype.key;
X.prototype.o=function(a){D("Firebase.child",1,1,arguments.length);if(fa(a))a=String(a);else if(!(a instanceof P))if(null===K(this.path)){var b=a;b&&(b=b.replace(/^\/*\.info(\/|$)/,"/"));ng("Firebase.child",b)}else ng("Firebase.child",a);return new X(this.k,this.path.o(a))};X.prototype.child=X.prototype.o;X.prototype.parent=function(){D("Firebase.parent",0,0,arguments.length);var a=this.path.parent();return null===a?null:new X(this.k,a)};X.prototype.parent=X.prototype.parent;
X.prototype.root=function(){D("Firebase.ref",0,0,arguments.length);for(var a=this;null!==a.parent();)a=a.parent();return a};X.prototype.root=X.prototype.root;X.prototype.set=function(a,b){D("Firebase.set",1,2,arguments.length);og("Firebase.set",this.path);gg("Firebase.set",a,this.path,!1);F("Firebase.set",2,b,!0);var c=new B;this.k.Ob(this.path,a,null,C(c,b));return c.D};X.prototype.set=X.prototype.set;
X.prototype.update=function(a,b){D("Firebase.update",1,2,arguments.length);og("Firebase.update",this.path);if(da(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;S("Passing an Array to Firebase.update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}jg("Firebase.update",a,this.path);F("Firebase.update",2,b,!0);c=new B;this.k.update(this.path,a,C(c,b));return c.D};
X.prototype.update=X.prototype.update;X.prototype.Ob=function(a,b,c){D("Firebase.setWithPriority",2,3,arguments.length);og("Firebase.setWithPriority",this.path);gg("Firebase.setWithPriority",a,this.path,!1);kg("Firebase.setWithPriority",2,b);F("Firebase.setWithPriority",3,c,!0);if(".length"===this.key()||".keys"===this.key())throw"Firebase.setWithPriority failed: "+this.key()+" is a read-only object.";var d=new B;this.k.Ob(this.path,a,b,C(d,c));return d.D};X.prototype.setWithPriority=X.prototype.Ob;
X.prototype.remove=function(a){D("Firebase.remove",0,1,arguments.length);og("Firebase.remove",this.path);F("Firebase.remove",1,a,!0);return this.set(null,a)};X.prototype.remove=X.prototype.remove;
X.prototype.transaction=function(a,b,c){D("Firebase.transaction",1,3,arguments.length);og("Firebase.transaction",this.path);F("Firebase.transaction",1,a,!1);F("Firebase.transaction",2,b,!0);if(p(c)&&"boolean"!=typeof c)throw Error(E("Firebase.transaction",3,!0)+"must be a boolean.");if(".length"===this.key()||".keys"===this.key())throw"Firebase.transaction failed: "+this.key()+" is a read-only object.";"undefined"===typeof c&&(c=!0);var d=new B;r(b)&&Nb(d.D);Si(this.k,this.path,a,function(a,c,g){a?
d.reject(a):d.resolve(new ei(c,g));r(b)&&b(a,c,g)},c);return d.D};X.prototype.transaction=X.prototype.transaction;X.prototype.Zg=function(a,b){D("Firebase.setPriority",1,2,arguments.length);og("Firebase.setPriority",this.path);kg("Firebase.setPriority",1,a);F("Firebase.setPriority",2,b,!0);var c=new B;this.k.Ob(this.path.o(".priority"),a,null,C(c,b));return c.D};X.prototype.setPriority=X.prototype.Zg;
X.prototype.push=function(a,b){D("Firebase.push",0,2,arguments.length);og("Firebase.push",this.path);gg("Firebase.push",a,this.path,!0);F("Firebase.push",2,b,!0);var c=Li(this.k),d=hf(c),c=this.o(d);if(null!=a){var e=this,f=c.set(a,b).then(function(){return e.o(d)});c.then=u(f.then,f);c["catch"]=u(f.then,f,void 0);r(b)&&Nb(f)}return c};X.prototype.push=X.prototype.push;X.prototype.lb=function(){og("Firebase.onDisconnect",this.path);return new V(this.k,this.path)};X.prototype.onDisconnect=X.prototype.lb;
X.prototype.O=function(a,b,c){S("FirebaseRef.auth() being deprecated. Please use FirebaseRef.authWithCustomToken() instead.");D("Firebase.auth",1,3,arguments.length);pg("Firebase.auth",a);F("Firebase.auth",2,b,!0);F("Firebase.auth",3,b,!0);var d=new B;dh(this.k.O,a,{},{remember:"none"},C(d,b),c);return d.D};X.prototype.auth=X.prototype.O;X.prototype.je=function(a){D("Firebase.unauth",0,1,arguments.length);F("Firebase.unauth",1,a,!0);var b=new B;eh(this.k.O,C(b,a));return b.D};X.prototype.unauth=X.prototype.je;
X.prototype.Be=function(){D("Firebase.getAuth",0,0,arguments.length);return this.k.O.Be()};X.prototype.getAuth=X.prototype.Be;X.prototype.Ig=function(a,b){D("Firebase.onAuth",1,2,arguments.length);F("Firebase.onAuth",1,a,!1);Qb("Firebase.onAuth",2,b);this.k.O.Ib("auth_status",a,b)};X.prototype.onAuth=X.prototype.Ig;X.prototype.Hg=function(a,b){D("Firebase.offAuth",1,2,arguments.length);F("Firebase.offAuth",1,a,!1);Qb("Firebase.offAuth",2,b);this.k.O.mc("auth_status",a,b)};X.prototype.offAuth=X.prototype.Hg;
X.prototype.hg=function(a,b,c){D("Firebase.authWithCustomToken",1,3,arguments.length);2===arguments.length&&Hb(b)&&(c=b,b=void 0);pg("Firebase.authWithCustomToken",a);F("Firebase.authWithCustomToken",2,b,!0);sg("Firebase.authWithCustomToken",3,c,!0);var d=new B;dh(this.k.O,a,{},c||{},C(d,b));return d.D};X.prototype.authWithCustomToken=X.prototype.hg;
X.prototype.ig=function(a,b,c){D("Firebase.authWithOAuthPopup",1,3,arguments.length);2===arguments.length&&Hb(b)&&(c=b,b=void 0);rg("Firebase.authWithOAuthPopup",a);F("Firebase.authWithOAuthPopup",2,b,!0);sg("Firebase.authWithOAuthPopup",3,c,!0);var d=new B;ih(this.k.O,a,c,C(d,b));return d.D};X.prototype.authWithOAuthPopup=X.prototype.ig;
X.prototype.jg=function(a,b,c){D("Firebase.authWithOAuthRedirect",1,3,arguments.length);2===arguments.length&&Hb(b)&&(c=b,b=void 0);rg("Firebase.authWithOAuthRedirect",a);F("Firebase.authWithOAuthRedirect",2,b,!1);sg("Firebase.authWithOAuthRedirect",3,c,!0);var d=new B,e=this.k.O,f=c,g=C(d,b);gh(e);var k=[Qg],f=Ag(f);"anonymous"===a||"firebase"===a?T(g,Sg("TRANSPORT_UNAVAILABLE")):(cd.set("redirect_client_options",f.qd),hh(e,k,"/auth/"+a,f,g));return d.D};X.prototype.authWithOAuthRedirect=X.prototype.jg;
X.prototype.kg=function(a,b,c,d){D("Firebase.authWithOAuthToken",2,4,arguments.length);3===arguments.length&&Hb(c)&&(d=c,c=void 0);rg("Firebase.authWithOAuthToken",a);F("Firebase.authWithOAuthToken",3,c,!0);sg("Firebase.authWithOAuthToken",4,d,!0);var e=new B;q(b)?(qg("Firebase.authWithOAuthToken",2,b),fh(this.k.O,a+"/token",{access_token:b},d,C(e,c))):(sg("Firebase.authWithOAuthToken",2,b,!1),fh(this.k.O,a+"/token",b,d,C(e,c)));return e.D};X.prototype.authWithOAuthToken=X.prototype.kg;
X.prototype.gg=function(a,b){D("Firebase.authAnonymously",0,2,arguments.length);1===arguments.length&&Hb(a)&&(b=a,a=void 0);F("Firebase.authAnonymously",1,a,!0);sg("Firebase.authAnonymously",2,b,!0);var c=new B;fh(this.k.O,"anonymous",{},b,C(c,a));return c.D};X.prototype.authAnonymously=X.prototype.gg;
X.prototype.lg=function(a,b,c){D("Firebase.authWithPassword",1,3,arguments.length);2===arguments.length&&Hb(b)&&(c=b,b=void 0);sg("Firebase.authWithPassword",1,a,!1);tg("Firebase.authWithPassword",a,"email");tg("Firebase.authWithPassword",a,"password");F("Firebase.authWithPassword",2,b,!0);sg("Firebase.authWithPassword",3,c,!0);var d=new B;fh(this.k.O,"password",a,c,C(d,b));return d.D};X.prototype.authWithPassword=X.prototype.lg;
X.prototype.ve=function(a,b){D("Firebase.createUser",1,2,arguments.length);sg("Firebase.createUser",1,a,!1);tg("Firebase.createUser",a,"email");tg("Firebase.createUser",a,"password");F("Firebase.createUser",2,b,!0);var c=new B;this.k.O.ve(a,C(c,b));return c.D};X.prototype.createUser=X.prototype.ve;
X.prototype.Xe=function(a,b){D("Firebase.removeUser",1,2,arguments.length);sg("Firebase.removeUser",1,a,!1);tg("Firebase.removeUser",a,"email");tg("Firebase.removeUser",a,"password");F("Firebase.removeUser",2,b,!0);var c=new B;this.k.O.Xe(a,C(c,b));return c.D};X.prototype.removeUser=X.prototype.Xe;
X.prototype.se=function(a,b){D("Firebase.changePassword",1,2,arguments.length);sg("Firebase.changePassword",1,a,!1);tg("Firebase.changePassword",a,"email");tg("Firebase.changePassword",a,"oldPassword");tg("Firebase.changePassword",a,"newPassword");F("Firebase.changePassword",2,b,!0);var c=new B;this.k.O.se(a,C(c,b));return c.D};X.prototype.changePassword=X.prototype.se;
X.prototype.re=function(a,b){D("Firebase.changeEmail",1,2,arguments.length);sg("Firebase.changeEmail",1,a,!1);tg("Firebase.changeEmail",a,"oldEmail");tg("Firebase.changeEmail",a,"newEmail");tg("Firebase.changeEmail",a,"password");F("Firebase.changeEmail",2,b,!0);var c=new B;this.k.O.re(a,C(c,b));return c.D};X.prototype.changeEmail=X.prototype.re;
X.prototype.Ze=function(a,b){D("Firebase.resetPassword",1,2,arguments.length);sg("Firebase.resetPassword",1,a,!1);tg("Firebase.resetPassword",a,"email");F("Firebase.resetPassword",2,b,!0);var c=new B;this.k.O.Ze(a,C(c,b));return c.D};X.prototype.resetPassword=X.prototype.Ze;})();


/*!
 * BackboneFire is the officially supported Backbone binding for Firebase. The
 * bindings let you use special model and collection types that allow for
 * synchronizing data with Firebase.
 *
 * BackboneFire 0.0.0
 * https://github.com/firebase/backbonefire/
 * License: MIT
 */

(function(_, Backbone) {
  'use strict';

  Backbone.Firebase = {};

  /**
   * A utility for retrieving the key name of a Firebase ref or
   * DataSnapshot. This is backwards-compatible with `name()`
   * from Firebase 1.x.x and `key()` from Firebase 2.0.0+. Once
   * support for Firebase 1.x.x is dropped in BackboneFire, this
   * helper can be removed.
   */
  Backbone.Firebase._getKey = function(refOrSnapshot) {
    return (typeof refOrSnapshot.key === 'function') ? refOrSnapshot.key() : refOrSnapshot.name();
  };

  /**
   * A utility for resolving whether an item will have the autoSync
   * property. Models can have this property on the prototype.
   */
  Backbone.Firebase._determineAutoSync = function(model, options) {
    var proto = Object.getPrototypeOf(model);
    return _.extend({
        autoSync: proto.hasOwnProperty('autoSync') ? proto.autoSync : true
      },
      this,
      options
    ).autoSync;
  };

  /**
   * Overriding of Backbone.sync.
   * All Backbone crud calls (destroy, add, create, save...) will pipe into
   * this method. This way Backbone can handle the prepping of the models
   * and the trigering of the appropiate methods. While sync can be overwritten
   * to handle updates to Firebase.
   */
  Backbone.Firebase.sync = function(method, model, options) {
    var modelJSON = model.toJSON();

    if (method === 'read') {

      Backbone.Firebase._readOnce(model.firebase, function onComplete(snap) {
        var resp = snap.val();
        if(options.success) {
          options.success(resp);
        }
      }, function _readOnceError(err) {
        if(options.error) {
          options.error(err);
        }
      });

    } else if (method === 'create') {

      Backbone.Firebase._setWithCheck(model.firebase, modelJSON, options);

    } else if (method === 'update') {

      Backbone.Firebase._updateWithCheck(model.firebase, modelJSON, options);

    } else if(method === 'delete') {

      Backbone.Firebase._setWithCheck(model.firebase, null, options);

    }

  };

  /**
   * A utility for a one-time read from Firebase.
   */
  Backbone.Firebase._readOnce = function(ref, onComplete) {
    ref.once('value', onComplete);
  };

  /**
   * A utility for a destructive save to Firebase.
   */
  Backbone.Firebase._setToFirebase = function(ref, item, onComplete) {
    ref.set(item, onComplete);
  };


  /**
   * A utility for a non-destructive save to Firebase.
   */
  Backbone.Firebase._updateToFirebase = function(ref, item, onComplete) {
    ref.update(item, onComplete);
  };

  /**
   * A utility for success and error events that are called after updates
   * from Firebase.
   */
  Backbone.Firebase._onCompleteCheck = function(err, item, options) {
    if(!options) { return; }

    if(err && options.error) {
      options.error(item, err, options);
    } else if(options.success) {
      options.success(item, null, options);
    }
  };

  /**
   * A utility for a destructive save to Firebase that handles success and
   * error events from the server.
   */
  Backbone.Firebase._setWithCheck = function(ref, item, options) {
    Backbone.Firebase._setToFirebase(ref, item, function(err) {
      Backbone.Firebase._onCompleteCheck(err, item, options);
    });
  };

  /**
   * A utility for a non-destructive save to Firebase that handles success and
   * error events from the server.
   */
  Backbone.Firebase._updateWithCheck = function(ref, item, options) {
    Backbone.Firebase._updateToFirebase(ref, item, function(err) {
      Backbone.Firebase._onCompleteCheck(err, item, options);
    });
  };

  /**
   * A utility for throwing errors.
   */
  Backbone.Firebase._throwError = function(message) {
    throw new Error(message);
  };


  /**
   * A utility for a determining whether a string or a Firebase
   * reference should be returned.
   *    string - return new Firebase('')
   *    object - assume object is ref and return
   */
  Backbone.Firebase._determineRef = function(objOrString) {
    switch (typeof(objOrString)) {
    case 'string':
      return new Firebase(objOrString);
    case 'object':
      return objOrString;
    default:
      Backbone.Firebase._throwError('Invalid type passed to url property');
    }
  };

  /**
   * A utility for assigning an id from a snapshot.
   *    object    - Assign id from snapshot key
   *    primitive - Throw error, primitives cannot be synced
   *    null      - Create blank object and assign id
   */
  Backbone.Firebase._checkId = function(snap, idAttribute) {
    var model = snap.val();

    // if the model is a primitive throw an error
    if (Backbone.Firebase._isPrimitive(model)) {
      Backbone.Firebase._throwError('InvalidIdException: Models must have an Id. Note: You may ' +
      'be trying to sync a primitive value (int, string, bool).');
    }

    // if the model is null set it to an empty object and assign its id
    // this way listeners can still be attached to populate the object in the future
    if(model === null) {
      model = {};
    }

    // set the id to the snapshot's key
    model[idAttribute] = Backbone.Firebase._getKey(snap);

    return model;
  };

  /**
   * A utility for checking if a value is a primitive
   */
  Backbone.Firebase._isPrimitive = function(value) {
    // is the value not an object and not null (basically, is it a primitive?)
    return !_.isObject(value) && value !== null;
  };

  /**
   * A naive promise-like implementation. Requires a syncPromise object.
   *
   * syncPromise is an object that has three properties.
   *  - resolve (bool) - Has the data been retreived from the server?
   *  - success (bool) - Was the data retrieved successfully?
   *  - error (Error)  - If there was an error, return the error object.
   *
   * This function relies on the syncPromise object being resolved from an
   * outside source. When the "resolve" property has been set to true,
   * the "success" and "error" functions will be evaluated.
   */
  Backbone.Firebase._promiseEvent = function(params) {
    // setup default values
    var syncPromise = params.syncPromise;
    var success = params.success;
    var error = params.error;
    var context = params.context || this;
    var complete = params.complete;

    // set up an interval that checks to see if data has been synced from the server
    var promiseInterval = setInterval(_.bind(function() {
      // if the result has been retrieved from the server
      if(syncPromise.resolve) {

        // on success fire off the event
        if(syncPromise.success) {
          success.call(context);
        }
        // on error fire off the returned error
        else if(syncPromise.err) {
          error.call(context, syncPromise.err);
        }

        // fire off the provided completed event
        if(complete) {
          complete.call(context);
        }

        // the "promise" has been resolved, clear the interval
        clearInterval(promiseInterval);
      }
    }, context));

  };

  /**
   * Model responsible for autoSynced objects
   * This model is never directly used. The Backbone.Firebase.Model will
   * inherit from this if it is an autoSynced model
   */
  var SyncModel = (function() {

    function SyncModel() {
      // Set up sync events
      this._initialSync = {};
      // apply remote changes locally
      this.firebase.on('value', function(snap) {
        this._setLocal(snap);
        this._initialSync.resolve = true;
        this._initialSync.success = true;
        this.trigger('sync', this, null, null);
      }, function(err) {
        // indicate that the call has been received from the server
        // and that an error has occurred
        this._initialSync.resolve = true;
        this._initialSync.err = err;
        this.trigger('error', this, err, null);
      }, this);

      // apply local changes remotely
      this._listenLocalChange(function(model) {
        this.firebase.update(model);
      });

    }

    SyncModel.protoype = {
      fetch: function(options) {
        Backbone.Firebase._promiseEvent({
          syncPromise: this._initialSync,
          context: this,
          success: function() {
            this.trigger('sync', this, null, options);
          },
          error: function(err) {
            this.trigger('err', this, err, options);
          },
          complete: function() {
            Backbone.Firebase._onCompleteCheck(this._initialSync.err, this, options);
          }
        });
      }
    };

    return SyncModel;
  }());

  /**
   * Model responsible for one-time requests
   * This model is never directly used. The Backbone.Firebase.Model will
   * inherit from this if it is an autoSynced model
   */
  var OnceModel = (function() {

    function OnceModel() {

      // when an unset occurs set the key to null
      // so Firebase knows to delete it on the server
      this._listenLocalChange(function(model) {
        this.set(model, { silent: true });
      });

    }

    return OnceModel;
  }());

  Backbone.Firebase.Model = Backbone.Model.extend({

    // Determine whether the realtime or once methods apply
    constructor: function(model, options) {
      Backbone.Model.apply(this, arguments);
      var defaults = _.result(this, 'defaults');

      // Apply defaults only after first sync.
      this.once('sync', function() {
        this.set(_.defaults(this.toJSON(), defaults));
      });

      this.autoSync = Backbone.Firebase._determineAutoSync(this, options);

      switch (typeof this.url) {
      case 'string':
        this.firebase = Backbone.Firebase._determineRef(this.url);
        break;
      case 'function':
        this.firebase = Backbone.Firebase._determineRef(this.url());
        break;
      case 'object':
        this.firebase = Backbone.Firebase._determineRef(this.url);
        break;
      default:
        Backbone.Firebase._throwError('url parameter required');
      }

      if(!this.autoSync) {
        OnceModel.apply(this, arguments);
        _.extend(this, OnceModel.protoype);
      } else {
        _.extend(this, SyncModel.protoype);
        SyncModel.apply(this, arguments);
      }

    },

    sync: function(method, model, options) {
      Backbone.Firebase.sync(method, model, options);
    },

    /**
     * Siliently set the id of the model to the snapshot key
     */
    _setId: function(snap) {
      // if the item new set the name to the id
      if(this.isNew()) {
        this.set(this.idAttribute, Backbone.Firebase._getKey(snap), { silent: true });
      }
    },

    /**
     * Proccess changes from a snapshot and apply locally
     */
    _setLocal: function(snap) {
      var newModel = this._unsetAttributes(snap);
      this.set(newModel);
    },

    /**
     * Unset attributes that have been deleted from the server
     * by comparing the keys that have been removed.
     */
    _unsetAttributes: function(snap) {
      var newModel = Backbone.Firebase._checkId(snap, this.idAttribute);

      if (typeof newModel === 'object' && newModel !== null) {
        var diff = _.difference(_.keys(this.attributes), _.keys(newModel));
        _.each(diff, _.bind(function(key) {
          this.unset(key);
        }, this));
      }

      // check to see if it needs an id
      this._setId(snap);

      return newModel;
    },

    /**
     * Find the deleted keys and set their values to null
     * so Firebase properly deletes them.
     */
    _updateModel: function(model) {
      var modelObj = model.changedAttributes();
      _.each(model.changed, function(value, key) {
        if (typeof value === 'undefined' || value === null) {
          if (key == model.idAttribute) {
            delete modelObj[key];
          } else {
            modelObj[key] = null;
          }
        }
      });

      return modelObj;
    },


    /**
     * Determine if the model will update for every local change.
     * Provide a callback function to call events after the update.
     */
    _listenLocalChange: function(cb) {
      var method = cb ? 'on' : 'off';
      this[method]('change', function(model) {
        var newModel = this._updateModel(model);
        if(_.isFunction(cb)){
          cb.call(this, newModel);
        }
      }, this);
    }

  });

  var OnceCollection = (function() {
    function OnceCollection() {

    }
    OnceCollection.protoype = {
      /**
       * Create an id from a Firebase push-id and call Backbone.create, which
       * will do prepare the models and trigger the proper events and then call
       * Backbone.Firebase.sync with the correct method.
       */
      create: function(model, options) {
        // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
        model[this.idAttribute] = model[this.idAttribute] || Backbone.Firebase._getKey(this.firebase.push());
        options = _.extend({ autoSync: false }, options);
        return Backbone.Collection.prototype.create.call(this, model, options);
      },
      /**
       * Create an id from a Firebase push-id and call Backbone.add, which
       * will do prepare the models and trigger the proper events and then call
       * Backbone.Firebase.sync with the correct method.
       */
      add: function(model, options) {
        // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
        model[this.idAttribute] = model[this.idAttribute] || Backbone.Firebase._getKey(this.firebase.push());
        options = _.extend({ autoSync: false }, options);
        return Backbone.Collection.prototype.add.call(this, model, options);
      },
      /**
       * Proxy to Backbone.Firebase.sync
       */
      sync: function(method, model, options) {
        Backbone.Firebase.sync(method, model, options);
      },
      /**
       * Firebase returns lists as an object with keys, where Backbone
       * collections require an array. This function modifies the existing
       * Backbone.Collection.fetch method by mapping the returned object from
       * Firebase to an array that Backbone can use.
       */
      fetch: function(options) {
        options = options ? _.clone(options) : {};
        if (options.parse === void 0) { options.parse = true; }
        var success = options.success;
        var collection = this;
        options.success = function(resp) {
          var arr = [];
          var keys = _.keys(resp);
          _.each(keys, function(key) {
            arr.push(resp[key]);
          });
          var method = options.reset ? 'reset' : 'set';
          collection[method](arr, options);
          if (success) { success(collection, arr, options); }
          options.autoSync = false;
          options.url = this.url;
          collection.trigger('sync', collection, arr, options);
        };
        return this.sync('read', this, options);
      }
    };

    return OnceCollection;
  }());

  var SyncCollection = (function() {

    function SyncCollection() {
      this._initialSync = {};
      // Add handlers for remote events
      this.firebase.on('child_added', _.bind(this._childAdded, this));
      this.firebase.on('child_moved', _.bind(this._childMoved, this));
      this.firebase.on('child_changed', _.bind(this._childChanged, this));
      this.firebase.on('child_removed', _.bind(this._childRemoved, this));

      // Once handler to emit 'sync' event whenever data changes
      // Defer the listener incase the data is cached, because
      // then the once call would be synchronous
      _.defer(_.bind(function() {
        this.firebase.once('value', function() {
          // indicate that the call has been received from the server
          // and the data has successfully loaded
          this._initialSync.resolve = true;
          this._initialSync.success = true;
          this.trigger('sync', this, null, null);
        }, function(err) {
          // indicate that the call has been received from the server
          // and that an error has occurred
          this._initialSync.resolve = true;
          this._initialSync.err = err;
          this.trigger('error', this, err, null);
        }, this);

      }, this));

      // Handle changes in any local models.
      this.listenTo(this, 'change', this._updateModel, this);
      // Listen for destroy event to remove models.
      this.listenTo(this, 'destroy', this._removeModel, this);
    }

    SyncCollection.protoype = {
      add: function(models, options) {
        // prepare models
        var parsed = this._parseModels(models);
        options = options ? _.clone(options) : {};
        options.success =
          _.isFunction(options.success) ? options.success : function() {};

        for (var i = 0; i < parsed.length; i++) {
          var model = parsed[i];

          if (options.silent === true) {
            this._suppressEvent = true;
          }

          // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
          var childRef = this.firebase.ref().child(model[this.idAttribute]);
          childRef.set(model, _.bind(options.success, model));
        }

        return parsed;
      },

      create: function(model, options) {
        options = options ? _.clone(options) : {};
        if (options.wait) {
          this._log('Wait option provided to create, ignoring.');
        }
        if (!model) {
          return false;
        }
        var set = this.add([model], options);
        return set[0];
      },

      remove: function(models, options) {
        var parsed = this._parseModels(models);
        options = options ? _.clone(options) : {};
        options.success =
          _.isFunction(options.success) ? options.success : function() {};

        for (var i = 0; i < parsed.length; i++) {
          var model = parsed[i];
          // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
          var childRef = this.firebase.child(model[this.idAttribute]);
          if (options.silent === true) {
            this._suppressEvent = true;
          }
          Backbone.Firebase._setWithCheck(childRef, null, options);
        }

        return parsed;
      },

      reset: function(models, options) {
        options = options ? _.clone(options) : {};
        // Remove all models remotely.
        this.remove(this.models, {silent: true});
        // Add new models.
        var ret = this.add(models, {silent: true});
        // Trigger 'reset' event.
        if (!options.silent) {
          this.trigger('reset', this, options);
        }
        return ret;
      },

      // This function does not actually fetch data from the server.
      // Rather, the "sync" event is fired when data has been loaded
      // from the server. Since the _initialSync property will indicate
      // whether the initial load has occurred, the "sync" event can
      // be fired once _initialSync has been resolved.
      fetch: function(options) {
        Backbone.Firebase._promiseEvent({
          syncPromise: this._initialSync,
          context: this,
          success: function() {
            this.trigger('sync', this, null, options);
          },
          error: function(err) {
            this.trigger('err', this, err, options);
          },
          complete: function() {
            Backbone.Firebase._onCompleteCheck(this._initialSync.err, this, options);
          }
        });
      },

      _log: function(msg) {
        if (console && console.log) {
          console.log(msg);
        }
      },

      _parseModels: function(models, options) {
        var pushArray = [];
        // check if the models paramter is an array or a single object
        var singular = !_.isArray(models);
        // if the models parameter is a single object then wrap it into an array
        models = singular ? (models ? [models] : []) : models.slice();

        for (var i = 0; i < models.length; i++) {
          var model = models[i];

          // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
          model[this.idAttribute] = model[this.idAttribute] || Backbone.Firebase._getKey(this.firebase.push());

          // call Backbone's prepareModel to apply options
          model = Backbone.Collection.prototype._prepareModel.call(
            this, model, options
          );

          if (model.toJSON && typeof model.toJSON == 'function') {
            model = model.toJSON();
          }

          pushArray.push(model);

        }

        return pushArray;
      },

      _childAdded: function(snap) {
        // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
        var model = Backbone.Firebase._checkId(snap, this.idAttribute);

        if (this._suppressEvent === true) {
          this._suppressEvent = false;
          Backbone.Collection.prototype.add.call(this, [model], {silent: true});
        } else {
          Backbone.Collection.prototype.add.call(this, [model]);
        }
        this.get(model[this.idAttribute])._remoteAttributes = model;
      },

      // TODO: child_moved is emitted when the priority for a child is changed, so it
      // should update the priority of the model and maybe trigger a sort
      _childMoved: function() {

      },

      // when a model has changed remotely find differences between the
      // local and remote data and apply them to the local model
      _childChanged: function(snap) {
        // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
        var idAttribute = this.idAttribute;
        var model = Backbone.Firebase._checkId(snap, idAttribute);

        var item = _.find(this.models, function(child) {
          return child.id == model[idAttribute];
        });

        if (!item) {
          // TODO: Investigate: what is the right way to handle this case?
          //throw new Error('Could not find model with ID ' + model.id);
          this._childAdded(snap);
          return;
        }

        this._preventSync(item, true);
        item._remoteAttributes = model;

        // find the attributes that have been deleted remotely and
        // unset them locally
        var diff = _.difference(_.keys(item.attributes), _.keys(model));
        _.each(diff, function(key) {
          item.unset(key);
        });

        item.set(model);
        // fire sync since this is a response from the server
        this.trigger('sync', this);
        this._preventSync(item, false);
      },

      // remove an item from the collection when removed remotely
      // provides the ability to remove siliently
      _childRemoved: function(snap) {
        // XXX model prototype broken: this.model.prototype.idAttribute worked around as this.idAttribute
        var model = Backbone.Firebase._checkId(snap, this.idAttribute);

        if (this._suppressEvent === true) {
          this._suppressEvent = false;
          Backbone.Collection.prototype.remove.call(
            this, [model], {silent: true}
          );
        } else {
          // trigger sync because data has been received from the server
          this.trigger('sync', this);
          Backbone.Collection.prototype.remove.call(this, [model]);
        }
      },

      // Add handlers for all models in this collection, and any future ones
      // that may be added.
      _updateModel: function(model) {
        var remoteAttributes;
        var localAttributes;
        var updateAttributes;
        var ref;

        // if the model is already being handled by listeners then return
        if (model._remoteChanging) {
          return;
        }

        remoteAttributes = model._remoteAttributes || {};
        localAttributes = model.toJSON();

        // consolidate the updates to Firebase
        updateAttributes = this._compareAttributes(remoteAttributes, localAttributes);

        ref = this.firebase.ref().child(model.id);

        // if '.priority' is present setWithPriority
        // else do a regular update
        if (_.has(updateAttributes, '.priority')) {
          this._setWithPriority(ref, localAttributes);
        } else {
          this._updateToFirebase(ref, localAttributes);
        }

      },

      // set the attributes to be updated to Firebase
      // set any removed attributes to null so that Firebase removes them
      _compareAttributes: function(remoteAttributes, localAttributes) {
        var updateAttributes = {};

        var union = _.union(_.keys(remoteAttributes), _.keys(localAttributes));

        _.each(union, function(key) {
          if (!_.has(localAttributes, key)) {
            updateAttributes[key] = null;
          } else if (localAttributes[key] != remoteAttributes[key]) {
            updateAttributes[key] = localAttributes[key];
          }
        });

        return updateAttributes;
      },

      // Special case if '.priority' was updated - a merge is not
      // allowed so we'll have to do a full setWithPriority.
      _setWithPriority: function(ref, item) {
        var priority = item['.priority'];
        delete item['.priority'];
        ref.setWithPriority(item, priority);
        return item;
      },

      // TODO: possibly pass in options for onComplete callback
      _updateToFirebase: function(ref, item) {
        ref.update(item);
      },

      // Triggered when model.destroy() is called on one of the children.
      _removeModel: function(model, collection, options) {
        options = options ? _.clone(options) : {};
        options.success =
          _.isFunction(options.success) ? options.success : function() {};
        var childRef = this.firebase.child(model.id);
        Backbone.Firebase._setWithCheck(childRef, null, _.bind(options.success, model));
      },

      _preventSync: function(model, state) {
        model._remoteChanging = state;
      }
    };

    return SyncCollection;
  }());

  Backbone.Firebase.Collection = Backbone.Collection.extend({

    constructor: function (model, options) {
      Backbone.Collection.apply(this, arguments);
      var self = this;
      var BaseModel = self.model;
      this.autoSync = Backbone.Firebase._determineAutoSync(this, options);

      switch (typeof this.url) {
      case 'string':
        this.firebase = Backbone.Firebase._determineRef(this.url);
        break;
      case 'function':
        this.firebase = Backbone.Firebase._determineRef(this.url());
        break;
      case 'object':
        this.firebase = Backbone.Firebase._determineRef(this.url);
        break;
      default:
        throw new Error('url parameter required');
      }

      // if we are not autoSyncing, the model needs
      // to be a non-autoSynced model
      if(!this.autoSync) {
        _.extend(this, OnceCollection.protoype);
        OnceCollection.apply(this, arguments);
      } else {
        _.extend(this, SyncCollection.protoype);
        SyncCollection.apply(this, arguments);
      }

      // XXX before breaking model prototype: worked around this.model.prototype.idAttribute with this.idAttribute
      this.idAttribute = this.idAttribute || BaseModel.prototype.idAttribute;

      // XXX breaking the model prototype
      // Intercept the given model and give it a firebase ref.
      // Have it listen to local changes silently. When attributes
      // are unset, the callback will set them to null so that they
      // are removed on the Firebase server.
      this.model = function(attrs, opts) {

        var newItem = new BaseModel(attrs, opts);
        newItem.autoSync = false;
        newItem.firebase = self.firebase.ref().child(newItem.id);
        newItem.sync = Backbone.Firebase.sync;
        newItem.on('change', function(model) {
          var updated = Backbone.Firebase.Model.prototype._updateModel(model);
          model.set(updated, { silent: true });
        });

        return newItem;

      };

    },

    comparator: function(model) {
      return model.id;
    }

  });

})(window._, window.Backbone);

// stats.js - http://github.com/mrdoob/stats.js
var Stats=function(){function f(a,e,b){a=document.createElement(a);a.id=e;a.style.cssText=b;return a}function l(a,e,b){var c=f("div",a,"padding:0 0 3px 3px;text-align:left;background:"+b),d=f("div",a+"Text","font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px;color:"+e);d.innerHTML=a.toUpperCase();c.appendChild(d);a=f("div",a+"Graph","width:74px;height:30px;background:"+e);c.appendChild(a);for(e=0;74>e;e++)a.appendChild(f("span","","width:1px;height:30px;float:left;opacity:0.9;background:"+
b));return c}function m(a){for(var b=c.children,d=0;d<b.length;d++)b[d].style.display=d===a?"block":"none";n=a}function p(a,b){a.appendChild(a.firstChild).style.height=Math.min(30,30-30*b)+"px"}var q=self.performance&&self.performance.now?self.performance.now.bind(performance):Date.now,k=q(),r=k,t=0,n=0,c=f("div","stats","width:80px;opacity:0.9;cursor:pointer");c.addEventListener("mousedown",function(a){a.preventDefault();m(++n%c.children.length)},!1);var d=0,u=Infinity,v=0,b=l("fps","#0ff","#002"),
A=b.children[0],B=b.children[1];c.appendChild(b);var g=0,w=Infinity,x=0,b=l("ms","#0f0","#020"),C=b.children[0],D=b.children[1];c.appendChild(b);if(self.performance&&self.performance.memory){var h=0,y=Infinity,z=0,b=l("mb","#f08","#201"),E=b.children[0],F=b.children[1];c.appendChild(b)}m(n);return{REVISION:14,domElement:c,setMode:m,begin:function(){k=q()},end:function(){var a=q();g=a-k;w=Math.min(w,g);x=Math.max(x,g);C.textContent=(g|0)+" MS ("+(w|0)+"-"+(x|0)+")";p(D,g/200);t++;if(a>r+1E3&&(d=Math.round(1E3*
t/(a-r)),u=Math.min(u,d),v=Math.max(v,d),A.textContent=d+" FPS ("+u+"-"+v+")",p(B,d/100),r=a,t=0,void 0!==h)){var b=performance.memory.usedJSHeapSize,c=performance.memory.jsHeapSizeLimit;h=Math.round(9.54E-7*b);y=Math.min(y,h);z=Math.max(z,h);E.textContent=h+" MB ("+y+"-"+z+")";p(F,b/c)}return a},update:function(){k=this.end()}}};"object"===typeof module&&(module.exports=Stats);
