/*!
 * Copyright 2010 - 2016 Pentaho Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define([
  "require",
  "./SpecificationScope",
  "./SpecificationContext",
  "../i18n!types",
  "../lang/Base",
  "../lang/_AnnotatableLinked",
  "../util/error",
  "../util/arg",
  "../util/object",
  "../util/fun",
  "../util/promise"
], function(localRequire, SpecificationScope, SpecificationContext, bundle, Base,
    AnnotatableLinked, error, arg, O, F, promiseUtil) {

  "use strict";

  // Unique type class id exposed through Type#uid and used by Context instances.
  var _nextUid = 1,
      _extractShortId = /^pentaho\/type\/(\w+)$/i,
      _normalAttrNames = [
        "description", "category", "helpUrl", "isBrowsable", "isAdvanced", "ordinal"
      ],
      O_isProtoOf = Object.prototype.isPrototypeOf;

  return function(context) {
    var _type = null;

    /**
     * @name pentaho.type.Type
     * @class
     *
     * @classDesc The base **type class** of the types of the Pentaho Client Metadata Model.
     *
     * For additional information, see the class of _instances_, {@link pentaho.type.Instance}.
     *
     * @description _Initializes_ the type's singleton object.
     * @param {Object} spec - The specification of this type.
     * @param {!Object} keyArgs - Keyword arguments.
     * @param {!pentaho.type.Instance} keyArgs.instance - The _prototype_ of the `Instance` class associated with
     * this type.
     * @param {boolean} [keyArgs.isRoot=false] Indicates if the type is a _root_ type.
     *
     */
    var Type = Base.extend("pentaho.type.Type", /** @lends pentaho.type.Type# */{

      constructor: function(spec, keyArgs) {
        if(!spec) spec = {};

        this._init(spec, keyArgs);

        this.extend(spec, keyArgs);

        this._postInit(spec, keyArgs);
      },

      /**
       * Performs initialization tasks that take place before the instance is extended with its specification.
       *
       * This method is typically overridden to block the inheritance of certain attributes.
       *
       * @param {!Object} spec - The specification of this type.
       * @param {!Object} keyArgs - Keyword arguments.
       * @param {!pentaho.type.Instance} keyArgs.instance - The _prototype_ of the `Instance` class associated with
       * this type.
       * @param {boolean} [keyArgs.isRoot=false] If `true`, creates a _root_ type.
       * @protected
       * @overridable
       */
      _init: function(spec, keyArgs) {

        O.setConst(this, "uid", _nextUid++);

        // Bind
        var instance = arg.required(keyArgs, "instance", "keyArgs");
        O.setConst(instance, "_type", this);
        O.setConst(this, "_instance", instance);

        if(arg.optional(keyArgs, "isRoot"))
          O.setConst(this, "root", this);

        // ----
        // Block inheritance, with default values

        // Don't use inherited property definition which may be writable false
        Object.defineProperty(this, "_id", {value: null, writable: true});

        this._shortId    = undefined;
        this._styleClass = null;
        this._isAbstract = false;

        // Don't use inherited property definition which may be writable false
        Object.defineProperty(this, "_hasDescendants", {value: false, writable: true});
      },

      /**
       * Performs initialization tasks that take place after the instance is extended with its specification.
       *
       * This method is typically overridden to validate the values of the attributes.
       *
       * The default implementation does nothing.
       *
       * @param {!Object} spec - The specification of this type.
       * @param {!Object} keyArgs - Keyword arguments.
       * @protected
       * @overridable
       */
      _postInit: function(spec, keyArgs) {
      },

      //region context property

      // NOTE: Any class extended from this will return the same context.
      /**
       * Gets the context that defined this type class.
       * @type pentaho.type.Context
       * @readOnly
       */
      get context() {
        return context;
      },
      //endregion

      //region uid property
      /**
       * Gets the unique identifier of this type.
       *
       * Unique type identifiers are auto-generated in each session.
       *
       * Note that even anonymous types -
       * those whose {@link pentaho.type.Type#id} is `null` -
       * have a unique identifier.
       *
       * This attribute is _not_ inherited.
       *
       * @type number
       * @readonly
       */
      uid: -1, // set in _init
      //endregion

      //region root property
      // `root` is generally set on direct sub-classes of Instance.
      // Should be the first meaningful, non-abstract instance class below `Instance` along a given branch.
      /**
       * Gets the root type of this type hierarchy.
       *
       * Even though the ultimate type root of types defined in this
       * system is [Instance]{@link pentaho.type.Instance},
       * the system is designed to represent multiple type hierarchies,
       * each representing concrete, more meaningful concepts.
       *
       * When deriving a type from `Instance`,
       * it can be marked as the _root_ of a type hierarchy,
       * by specifying the `isRoot` keyword argument to `extend`.
       *
       * Typically, root types are immediate subtypes of `Instance`.
       * However, this is not enforced and it is up to the developer to decide
       * at what level a practical, meaningful type root arises.
       *
       * For example, [Value]{@link pentaho.type.Value} is the root of _value_ types.
       * However, [Property]{@link pentaho.type.Property},
       * also an immediate subtype of `Instance`,
       * is not considered a root type.
       * It is the immediate subtypes of `Property` -
       * each root property within a complex type -
       * which are considered roots.
       * This aligns with users expectations of what an attribute named `root`
       * in a property type should mean.
       *
       * @name root
       * @memberOf pentaho.type.Type#
       * @type pentaho.type.Type
       * @readonly
       * @see pentaho.type.Type#isRoot
       * @see pentaho.type.Type#ancestor
       */

      /**
       * Gets a value that indicates if this type is the root of its type hierarchy.
       *
       * @type boolean
       *
       * @readonly
       *
       * @see pentaho.type.Type#root
       */
      get isRoot() {
        return this === this.root;
      },
      //endregion

      //region ancestor property
      /**
       * Gets the parent type in the current type hierarchy, if any, or `null`.
       *
       * The root type returns `null`.
       *
       * @type ?pentaho.type.Type
       * @readonly
       * @see pentaho.type.Type#root
       * @see pentaho.type.Type#hasDescendants
       */
      get ancestor() {
        return this.isRoot ? null : Object.getPrototypeOf(this);
      },
      //endregion

      //region hasDescendants property
      /**
       * Gets a value that indicates if this type has any descendant types.
       *
       * @type {boolean}
       * @readonly
       * @see pentaho.type.Type#ancestor
       */
      get hasDescendants() {
        return this._hasDescendants;
      },
      //endregion

      //region instance property
      /**
       * Gets the _prototype_ of the instances of this type.
       *
       * @type pentaho.type.Instance
       * @readOnly
       */
      get instance() {
        return this._instance;
      },

      // Supports Instance configuration only, from the type side.
      // To be used in type specifications, to change the instance side.
      // Not documented on purpose.
      set instance(config) {
        // Class.implement essentially just calls Class#extend.
        /* istanbul ignore else: no comments */
        if(config) this.instance.extend(config);
      }, //jshint -W078
      //endregion

      //region Type Kinds
      //region isValue property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} a
       * [value]{@link pentaho.type.Value.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isValue() { return false; },
      //endregion

      //region isProperty property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} a
       * [property]{@link pentaho.type.Property.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isProperty() { return false; },
      //endregion

      //region isContainer property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} a
       * [list]{@link pentaho.type.List.Type} or a
       * [complex]{@link pentaho.type.Complex.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isContainer() { return false; },
      //endregion

      //region isList property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} a
       * [list]{@link pentaho.type.List.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isList() { return false; },
      //endregion

      //region isElement property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} an
       * [element]{@link pentaho.type.Element.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isElement() { return false; },
      //endregion

      //region isRefinement property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} a
       * [refinement]{@link pentaho.type.Refinement.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isRefinement() { return false; },
      //endregion

      //region isComplex property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} an
       * [complex]{@link pentaho.type.Complex.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isComplex() { return false; },
      //endregion

      //region isSimple property
      /**
       * Gets a value that indicates if this type
       * [is]{@link pentaho.type.Type#isSubtypeOf} an
       * [simple]{@link pentaho.type.Simple.Type} type.
       *
       * @type boolean
       * @readOnly
       */
      get isSimple() { return false; },
      //endregion

      //endregion

      //region id property

      // -> nonEmptyString, Optional(null), Immutable, Shared (note: not Inherited)
      // "" -> null conversion

      _id: null,

      /**
       * Gets the identifier of this type.
       *
       * The identifier of a type can only be specified when extending the ancestor type.
       *
       * The identifier is only defined for types which have an associated AMD/RequireJS module.
       * However, note that all have a {@link pentaho.type.Type#uid}.
       *
       * This attribute is not inherited.
       *
       * @type {?nonEmptyString}
       * @readonly
       */
      get id() {
        return this._id;
      },

      set id(value) {
        value = nonEmptyString(value);

        // Is it a temporary id? If so, ignore it.
        if(SpecificationContext.isIdTemporary(value)) value = null;

        // Can only be set once or throws.
        O.setConst(this, "_id", value);
      },

      /**
       * Gets the short id of this type.
       *
       * When a type is one of the standard types,
       * and thus a direct sub-module of the `pentaho/type` module,
       * its short identifier is its _local module id_,
       * like `"string"` or `"boolean"`.
       *
       * Otherwise, the short identifier is equal to the identifier.
       *
       * @type {?nonEmptyString}
       * @readOnly
       * @see pentaho.type.Type#id
       */
      get shortId() {
        var shortId = this._shortId, id, m;
        if(shortId === undefined) {
          if((id = this._id) && (m = _extractShortId.exec(id))) {
            shortId = m[1];
          } else {
            shortId = id;
          }
          this._shortId = shortId;
        }

        return shortId;
      },

      _buildRelativeId: function(value) {
        // A module id.
        // Unless it starts with a "/", it's relative to this Type#id.
        // Relative:
        //   View
        //   ./View
        // Absolute:
        //   foo.js
        //   /View
        //   http:
        if(!/(^\w+:)|(^\/)|(\.js$)/.test(value)) {
          // Considered relative.
          // Also works well if the value has ./ or ../
          var id = this.id;
          value = (id ? (id + "/") : "") + value;
        }

        return value;
      },
      //endregion

      //region isAbstract property
      // @type boolean
      // -> boolean, Optional(false)

      // Default value is for `Type` only.
      // @see Type#constructor.
      _isAbstract: true,

      /**
       * Gets or sets a value that indicates if this type is abstract.
       *
       * This attribute can only be set once, upon the type definition.
       *
       * @type {boolean}
       * @default false
       */
      get isAbstract() {
        return this._isAbstract;
      },

      set isAbstract(value) {
        // nully is reset, which is false, so !! works well.
        this._isAbstract = !!value;
      },
      //endregion

      //region label property
      // must have some non-null value to inherit
      _label: "instance",
      _labelSet: false,

      /**
       * Gets or sets the label of this type.
       *
       * When set to a non-{@link Nully} and non-{@link String} value,
       * the value is first replaced by the result of calling its `toString` method.
       *
       * When set to an empty string or a _nully_ value, the attribute value is _reset_.
       *
       * When reset, the attribute assumes its _default value_
       * (except on the top-root type, `Instance.type`, in which case it has no effect).
       *
       * The _default value_ is the _inherited value_.
       *
       * The _initial value_ of the attribute on the top-root type is `"instance"`.
       *
       * @type {!nonEmptyString}
       */
      get label() {
        return this._label;
      },

      set label(value) {
        value = nonEmptyString(value);
        if(value === null) {
          this._resetLabel();
        } else {
          this._labelSet = true;
          this._label = value;
        }
      },

      _resetLabel: function() {
        this._labelSet = false;

        if(this !== _type) {
          delete this._label;
        }
      },
      //endregion

      //region description property

      // -> nonEmptyString, Optional, Inherited, Configurable, Localized
      // "" -> null conversion

      _description: null, // set through implement bundle, below

      /**
       * Gets or sets the description of this type.
       *
       * Attempting to set to a non-string value type implicitly converts the value to a string before assignment.
       *
       * Setting this to `undefined` causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where this attribute is `null`.
       *
       * Setting this to `null` or to an empty string clears the attribute and sets it to `null`,
       * ignoring any inherited value.
       *
       * @type {?nonEmptyString}
       */
      get description() {
        return this._description;
      },

      set description(value) {
        if(value === undefined) {
          this._resetDescription();
        } else {
          this._description = nonEmptyString(value);
        }
      },

      _resetDescription: function() {
        if(this !== _type) {
          delete this._description;
        }
      },
      //endregion

      //region category property

      // -> nonEmptyString, Optional, Inherited, Configurable, Localized
      // "" -> null conversion

      _category: null,

      /**
       * Gets or sets the category associated with this type.
       *
       * The category is used primarily to group similar types (or instances of) in a user interface.
       *
       * Attempting to set to a non-string value type implicitly
       * converts the value to a string before assignment.
       *
       * Setting this to `undefined` causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `null`.
       *
       * Setting this to `null` or to an empty string clears the attribute and sets it to `null`,
       * thus ignoring any inherited value.
       *
       * @type {?nonEmptyString}
       * @see pentaho.type.Type#isBrowsable
       * @see pentaho.type.Type#ordinal
       */
      get category() {
        return this._category;
      },

      set category(value) {
        if(value === undefined) {
          this._resetCategory();
        } else {
          this._category = nonEmptyString(value);
        }
      },

      _resetCategory: function() {
        if(this !== _type) {
          delete this._category;
        }
      },
      //endregion

      //region helpUrl property

      // -> nonEmptyString, Optional, Inherited, Configurable, Localized?
      // "" -> null conversion

      _helpUrl: null,

      /**
       * Gets or sets a URL pointing to documentation associated with this type.
       *
       * Attempting to set to a non-string value type implicitly
       * converts the value to a string before assignment.
       *
       * Setting this to `undefined` causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `null`.
       *
       * Setting this to `null` or to an empty string clears the attribute and sets it to `null`,
       * ignoring any inherited value.
       *
       * @type {?nonEmptyString}
       */
      get helpUrl() {
        return this._helpUrl;
      },

      set helpUrl(value) {
        if(value === undefined) {
          this._resetHelpUrl();
        } else {
          this._helpUrl = nonEmptyString(value);
        }
      },

      _resetHelpUrl: function() {
        if(this !== _type) {
          delete this._helpUrl;
        }
      },
      //endregion

      //region isBrowsable property
      // @type boolean
      // -> boolean, Optional(true), Inherited, Configurable
      // undefined or null -> resets

      _isBrowsable: true,

      /**
       * Gets or sets the `isBrowsable` attribute of this type.
       *
       * Browsable types are exposed to the end user.
       * Set this attribute to `false` to prevent exposing the type in a user interface.
       *
       * Setting this to a {@link Nully} value causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `true`.
       *
       * @type {boolean}
       */
      get isBrowsable() {
        return this._isBrowsable;
      },

      set isBrowsable(value) {
        if(value == null) {
          this._resetIsBrowsable();
        } else {
          this._isBrowsable = !!value;
        }
      },

      _resetIsBrowsable: function() {
        if(this !== _type) {
          delete this._isBrowsable;
        }
      },
      //endregion

      //region isAdvanced property
      // @type boolean
      // -> boolean, Optional(false), Inherited, Configurable
      // null || undefined -> reset
      _isAdvanced: false,

      /**
       * Gets or sets the `isAdvanced` attribute of this type.
       *
       * Types with `isAdvanced` attributes set to `false` are typically immediately accessible to the user.
       * An advanced type typically escapes the expected flow of utilization, yet it is
       * sufficiently relevant to be shown in a user interface.
       *
       * Setting this to a {@link Nully} value causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `false`.
       *
       * @type {boolean}
       * @see pentaho.type.Type#isBrowsable
       */
      get isAdvanced() {
        return this._isAdvanced;
      },

      set isAdvanced(value) {
        if(value == null) {
          this._resetIsAdvanced();
        } else {
          this._isAdvanced = !!value;
        }
      },

      _resetIsAdvanced: function() {
        if(this !== _type) {
          delete this._isAdvanced;
        }
      },
      //endregion

      //region styleClass property
      // @type nonEmptyString
      // -> nonEmptyString, Optional(null), Configurable, Localized
      // "" or undefined -> null conversion

      _styleClass: null,

      /**
       * Gets or sets the CSS class associated with this type.
       *
       * This attribute is typically used to associate an icon with a type.
       *
       * Attempting to set to a non-string value type implicitly
       * converts the value to a string before assignment.
       *
       * An empty string or `undefined` value is interpreted as `null`.
       *
       * @type {?nonEmptyString}
       */
      get styleClass() {
        return this._styleClass;
      },

      set styleClass(value) {
        // undefined or "" -> null conversion
        this._styleClass = nonEmptyString(value);
      },

      // TODO: implement inheritedStyleClasses
      /**
       * Gets the style classes of this and any base types.
       *
       * @type string[]
       * @readonly
       */
      get inheritedStyleClasses() {
        /* istanbul ignore next: not implemented yet */
        throw error.notImplemented("Implement me!");
      },
      //endregion

      //region ordinal property
      // @type integer
      // -> Optional(0), Inherited, Configurable
      _ordinal: 0,

      /**
       * Gets or sets the ordinal associated with this type.
       *
       * The ordinal is used to disambiguate the order with which a type (or an instance of it)
       * is shown in a user interface.
       *
       * Setting this to a {@link Nully} value causes this attribute to use the inherited value,
       * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `0`.
       *
       * @type {number}
       * @see pentaho.type.Type#isBrowsable
       * @see pentaho.type.Type#category
       */
      get ordinal() {
        return this._ordinal;
      },

      set ordinal(value) {
        if(value == null) {
          this._resetOrdinal();
        } else {
          this._ordinal = Math.floor((+value) || 0);
        }
      },

      _resetOrdinal: function() {
        if(this !== _type) {
          delete this._ordinal;
        }
      },
      //endregion

      //region view property

      // TODO: When type is anonymous, is view an absolute path?

      // -> nonEmptyString, Optional, Inherited, Configurable, Localized
      // undefined -> inherit
      // null -> clear
      // "" -> null conversion

      _view: null, // {value: any, promise: Promise.<Class.<View>>}

     /**
      * Gets or sets the default view for instances of this type.
      *
      * When a string,
      * it is the identifier of the view's AMD module.
      * If the string starts with `/` or `xyz:`, or ends with `.js`,
      * the identifier is considered to be absolute;
      * otherwise,
      * it is relative to this type's identifier folder, and converted to an absolute identifier.
      *
      * Setting this to `undefined` causes the view to be inherited from the ancestor type,
      * except for the root type, `Instance.type` (which has no ancestor), where the attribute is `null`.
      *
      * Setting this to a _falsy_ value (like `null` or an empty string),
      * clears the value of the attribute and sets it to `null`, ignoring any inherited value.
      *
      * When a function,
      * it is the class or factory of the view.
      *
      * @see pentaho.type.Type#viewClass
      *
      * @type {string | function}

      * @throws {pentaho.lang.ArgumentInvalidTypeError} When the set value is not
      * a string, a function or {@link Nully}.
      */
      get view() {
        return this._view && this._view.value;
      },

      set view(value) {
        if(value === undefined) {
          this._resetView();
        } else if(!value) { // null || ""
          this._view = null;
        } else  if(typeof value === "string") {
          value = this._buildRelativeId(value);
          if(!this._view || this._view.value !== value) {
            this._view = {value: value, promise: null};
          }
        } else if(typeof value === "function") {
          // Assume it is the View class itself, already fulfilled.
          if(!this._view || this._view.value !== value) {
            this._view = {value: value, promise: Promise.resolve(value)};
          }
        } else {
          throw error.argInvalidType("view", ["nully", "string", "function"], typeof value);
        }
      },

      _resetView: function() {
        if(this !== _type) {
          delete this._view;
        }
      },

      /**
       * Gets a promise for the default view class or factory, if any, or `null`.
       *
       * A default view exists if property {@link pentaho.type.Type#view}
       * has a non-null value.
       *
       * @type Promise.<?function>
       * @readOnly
       * @see pentaho.type.Type#view
       */
      get viewClass() {
        /*jshint laxbreak:true*/
        var view = this._view;
        return view
            ? (view.promise || (view.promise = promiseUtil.require(view.value, localRequire)))
            : Promise.resolve(null);
      },
      //endregion

      /**
       * Creates a subtype of this one.
       *
       * This method creates a subtype that does not have own instance or type constructors.
       * The base type's instance and type constructors are used to _initialize_ instances and the type.
       *
       * To create a type with own constructors,
       * extend from the base instance constructor instead,
       * by calling its `extend` method.
       *
       * @param {object} [typeSpec] The new type specification.
       * @param {object} [keyArgs] Keyword arguments.
       *
       * @return {pentaho.type.Type} The created subtype.
       */
      extendProto: function(typeSpec, keyArgs) {
        if(!typeSpec) typeSpec = {};

        var baseInstProto = this.instance;

        // INSTANCE I
        var instProto = Object.create(baseInstProto);

        // TYPE
        O.setConst(this, "_hasDescendants", true);

        var type = Object.create(this);

        var ka = keyArgs ? Object.create(keyArgs) : {};
        ka.instance = instProto;
        ka.exclude  = {instance: 1};

        // NOTE: `type.constructor` is still the "base" constructor.
        type.constructor(typeSpec, ka);

        // INSTANCE II
        instProto.extend(typeSpec && typeSpec.instance, {exclude: {type: 1}});

        return type;
      },

      //region creation
      /**
       * Creates an instance of this type, given an instance specification.
       *
       * If the specified instance specification contains an inline type reference,
       * in property `"_"`, the referenced type is used to create the instance
       * (as long as it is a subtype of this type).
       *
       * If the specified instance specification does not contain an inline type reference,
       * the type is assumed to be this type.
       *
       * @see pentaho.type.Type#isSubtypeOf
       * @see pentaho.type.Context#get
       *
       * @example
       * <caption>
       *   Create a complex instance from a specification that contains the type inline.
       * </caption>
       *
       * require(["pentaho/type/Context"], function(Context) {
       *
       *   var context = new Context({application: "data-explorer-101"});
       *   var Value   = context.get("value");
       *
       *   var product = Value.type.create({
       *         _: {
       *           props: ["id", "name", {name: "price", type: "number"}]
       *         },
       *
       *         id:    "mpma",
       *         name:  "Principia Mathematica",
       *         price: 1200
       *       });
       *
       *   // ...
       *
       * });
       *
       * @example
       * <caption>
       *   Create a list instance from a specification that contains the type inline.
       * </caption>
       *
       * require(["pentaho/type/Context"], function(Context) {
       *
       *   var context = new Context({application: "data-explorer-101"});
       *   var Value   = context.get("value");
       *
       *   var productList = Value.type.create({
       *         _: [{
       *           props: ["id", "name", {name: "price", type: "number"}]
       *         }],
       *
       *         d: [
       *           {id: "mpma", name: "Principia Mathematica", price: 1200},
       *           {id: "flot", name: "The Laws of Thought",   price:  500}
       *         ]
       *       });
       *
       *   // ...
       *
       * });
       *
       * @example
       * <caption>
       *   Create an instance from a specification that <b>does not</b> contain the type inline.
       * </caption>
       *
       * require(["pentaho/type/Context"], function(Context) {
       *
       *   var context = new Context({application: "data-explorer-101"});
       *   var ProductList = context.get([{
       *           props: [
       *             "id",
       *             "name",
       *             {name: "price", type: "number"}
       *           ]
       *         }]);
       *
       *   // Provide the default type, in case the instance spec doesn't provide one.
       *   var productList = ProductList.type.create(
       *          [
       *            {id: "mpma", name: "Principia Mathematica", price: 1200},
       *            {id: "flot", name: "The Laws of Thought",   price:  500}
       *         ]);
       *
       *   // ...
       *
       * });
       *
       * @param {pentaho.type.spec.UInstance} [instSpec] An instance specification.
       *
       * @return {!pentaho.type.Instance} The created instance.
       *
       * @throws {pentaho.lang.OperationInvalidError} When `instSpec` contains an inline type reference
       * that refers to a type that is not a subtype of this one.
       *
       * @throws {pentaho.lang.OperationInvalidError} When the determined type for the specified `instSpec`
       * is an [abstract]{@link pentaho.type.Value.Type#isAbstract} type.
       */
      create: function(instSpec) {
        var Instance, typeSpec;

        // If it is a plain Object, does it have the inline type property, "_"?
        if(instSpec && typeof instSpec === "object" && (typeSpec = instSpec._) && instSpec.constructor === Object) {

          Instance = context.get(typeSpec);

          if(this._assertSubtype(Instance.type).isAbstract)
            Instance.type._throwAbstractType();

        } else {
          if(this.isAbstract) this._throwAbstractType();

          // Does this type have an own constructor?
          var baseInst = this.instance;

          Instance = baseInst.constructor;

          if(Instance.prototype !== baseInst) {
            // Type was created through extendProto.
            var inst = Object.create(baseInst);
            return Instance.apply(inst, arguments) || inst;
          }
        }

        return O.make(Instance, arguments);
      },

      /**
       * Asserts that a given type is a subtype of this type.
       *
       * @param {!pentaho.type.Type} subtype - The subtype to assert.
       *
       * @return {!pentaho.type.Type} The subtype `subtype`.
       *
       * @throws {pentaho.lang.OperationInvalidError} When `subtype` is not a subtype of this.
       *
       * @private
       */
      _assertSubtype: function(subtype) {
        if(!subtype.isSubtypeOf(this)) {
          throw error.operInvalid(
              bundle.format(bundle.structured.errors.instance.notOfExpectedBaseType, [this]));
        }

        return subtype;
      },

      /**
       * Throws an error complaining that the type is abstract and cannot create instances.
       *
       * @throws {pentaho.lang.OperationInvalidError} When this is not an abstract type.
       *
       * @private
       */
      _throwAbstractType: function() {
        throw error.operInvalid(bundle.format(
            bundle.structured.errors.instance.cannotCreateInstanceOfAbstractType, [this]));
      },
      //endregion

      /**
       * Determines if a value is an instance of this type.
       *
       * @param {?any} value - The value to test.
       * @return {boolean} `true` if the value is an instance of this type; `false`, otherwise.
       */
      is: function(value) {
        return O_isProtoOf.call(this.instance, value);
      },

      /**
       * Determines if this is a subtype of another.
       *
       * A type is considered a subtype of itself.
       *
       * @param {?pentaho.type.Type} superType - The candidate super-type.
       * @return {boolean} `true` if this is a subtype of `superType` type; `false`, otherwise.
       */
      isSubtypeOf: function(superType) {
        return !!superType && (superType === this || O_isProtoOf.call(superType, this));
      },

      // TODO: is conversion always successful? If so, should it be?
      /**
       * Converts a value to an instance of this type,
       * if it is not one already.
       *
       * If a {@link Nully} value is specified, `null` is returned.
       *
       * Otherwise, if a given value is not already an instance of this type
       * (checked using [is]{@link pentaho.type.Type#is}),
       * this method delegates the creation of an instance to
       * [create]{@link pentaho.type.Type#create}.
       *
       * @param {?any} value - The value to convert.
       * @return {?pentaho.type.Instance} The converted value or `null`.
       */
      to: function(value) {
        return value == null   ? null  :
               this.is(value)  ? value :
               this.create(value);
      },

      //region serialization
      /**
       * Creates a specification that describes this type.
       *
       * If an [ambient specification context]{@link pentaho.type.SpecificationContext.current},
       * currently exists, it is used to manage the serialization process.
       * Otherwise, one is created and set as current.
       *
       * This method creates a new {@link pentaho.type.SpecificationScope} for describing
       * this type, and any other instances and types it references,
       * and then delegates the actual work to {@link pentaho.type.Type#toSpecInContext}.
       *
       * @param {Object} [keyArgs] The keyword arguments object.
       * Passed to every type and instance serialized within this scope.
       *
       * Please see the documentation of subclasses for information on additional, supported keyword arguments.
       *
       * @param {?boolean} [keyArgs.isJson=false] Generates a JSON-compatible specification.
       * Attributes that don't have a JSON-compatible specification are omitted.
       *
       * @return {!pentaho.type.spec.ITypeProto} A specification of this type.
       *
       * @see pentaho.type.Type#toSpecInContext
       * @see pentaho.type.Type#_fillSpecInContext
       */
      toSpec: function(keyArgs) {
        return O.using(new SpecificationScope(), this.toSpecInContext.bind(this, keyArgs || {}));
      },

      /**
       * Creates a specification that describes this type.
       *
       * This method requires that there currently exists an
       * [ambient specification context]{@link pentaho.type.SpecificationContext.current}.
       *
       * The default implementation returns a plain object with the identifier of the type and
       * any other specified attributes
       * (like [label]{@link pentaho.type.Type#label} or [description]{@link pentaho.type.Type#description}).
       *
       * @param {Object} [keyArgs] The keyword arguments object.
       * Passed to every type and instance serialized within this scope.
       *
       * Please see the documentation of subclasses for information on additional, supported keyword arguments.
       *
       * @return {!pentaho.type.spec.ITypeProto} A specification of this type.
       *
       * @see pentaho.type.Type#toSpec
       */
      toSpecInContext: function(keyArgs) {

        var spec = {id: this.shortId || SpecificationContext.current.add(this)};

        this._fillSpecInContext(spec, keyArgs || {});

        return spec;
      },

      /**
       * Creates a JSON specification that describes this type.
       *
       * Attributes which don't have a JSON-compatible specification are omitted.
       * Specifically, attributes with a function value are not supported.
       *
       * This method simply calls {@link @see pentaho.type.Instance#toSpec} with argument `keyArgs.isJson` as `true`
       * and exists for seamless integrations with JavaScript's
       * [JSON.stringify](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
       * method.
       *
       * @see pentaho.type.Instance#toSpec
       *
       * @return {UJsonValue} A JSON-compatible specification.
       */
      toJSON: function() {
        return this.toSpec({isJson: true});
      },

      /**
       * Fills the given specification with this type's attributes' local values,
       * and returns whether any attribute was actually added.
       *
       * This method requires that there currently exists an
       * [ambient specification context]{@link pentaho.type.SpecificationContext.current}.
       *
       * This method does _not_ add the special `id` and `base` attributes to the specification.
       *
       * @param {!Object} spec - The specification to be filled.
       * @param {Object} [keyArgs] The keyword arguments object.
       * Passed to every type and instance serialized within this scope.
       *
       * Please see the documentation of subclasses for information on additional, supported keyword arguments.
       *
       * @return {boolean} Returns `true` if any attribute was added; `false`, otherwise.
       *
       * @protected
       *
       * @see pentaho.type.Instance#toSpecInContext
       */
      _fillSpecInContext: function(spec, keyArgs) {
        var any = false;
        var isJson = keyArgs.isJson;

        if(this._labelSet && O.hasOwn(this, "_label")) {
          any = true;
          spec.label = this._label;
        }

        // Normal attributes
        _normalAttrNames.forEach(function(name) {
          var _name = "_" + name, v;
          // !== undefined ensures refinement fields are well handled as well
          if(O.hasOwn(this, _name) && (v = this[_name]) !== undefined) {
            any = true;
            spec[name] = v;
          }
        }, this);

        // Custom attributes
        if(!this.isRefinement && this.isAbstract) {
          any = true;
          spec.isAbstract = true;
        }

        var styleClass = this._styleClass;
        if(styleClass) {
          any = true;
          spec.styleClass = styleClass;
        }

        var viewInfo = O.getOwn(this, "_view");
        if(viewInfo !== undefined) { // can be null
          var view = viewInfo && viewInfo.value;
          if(!view || !isJson || !F.is(view)) {
            any = true;
            spec.view = view;
          }
        }

        return any;
      },

      /**
       * Returns a _reference_ to this type.
       *
       * This method returns a reference to this type that is appropriate
       * to be the value of an [inline type]{@link pentaho.type.spec.IInstance#_} property
       * that is included on a specification of an instance of this type.
       *
       * If an [ambient specification context]{@link pentaho.type.SpecificationContext.current},
       * currently exists, it is used to manage the serialization process.
       * Otherwise, one is created and set as current.
       *
       * When a type is not anonymous, the cheapest reference,
       * the [id]{@link pentaho.type.Type#id}, is returned.
       *
       * For anonymous types, a [temporary]{@link pentaho.type.SpecificationContext.isIdTemporary},
       * serialization-only identifier is generated.
       * In the first occurrence in the given scope,
       * that identifier is returned, within a full specification of the type,
       * obtained by calling [toSpecInContext]{@link pentaho.type.Type#toSpecInContext}.
       * In following occurrences, only the previously used temporary identifier is returned.
       *
       * Some standard types have a special reference syntax,
       * for example, [List.Type#toRef]{@link pentaho.type.List.Type#toRef}.
       *
       * @see pentaho.type.Type#toSpec
       *
       * @param {Object} [keyArgs] The keyword arguments object.
       * Passed to every type and instance serialized within this scope.
       *
       * Please see the documentation of subclasses for information on additional, supported keyword arguments.
       *
       * @return {!pentaho.type.spec.UTypeReference} A reference to this type.
       */
      toRef: function(keyArgs) {
        return this.shortId || O.using(new SpecificationScope(), this.toRefInContext.bind(this, keyArgs || {}));
      },

      /**
       * Returns a _reference_ to this type under a given specification context.
       *
       * This method requires that there currently exists an
       * [ambient specification context]{@link pentaho.type.SpecificationContext.current}.
       *
       * @see pentaho.type.Type#toRef
       *
       * @param {Object} [keyArgs] The keyword arguments object.
       * Passed to every type and instance serialized within this scope.
       *
       * Please see the documentation of subclasses for information on additional, supported keyword arguments.
       *
       * @return {!pentaho.type.spec.UTypeReference} A reference to this type.
       */
      toRefInContext: function(keyArgs) {
        return this.shortId || SpecificationContext.current.getIdOf(this) || this.toSpecInContext(keyArgs);
      },
      //endregion

      /**
       * Returns a textual representation suitable to identify this type in an error message.
       *
       * @return {string} A textual representation.
       */
      toString: function() {
        return this.id || this.label; // Never empty;
      }
    }, /** @lends pentaho.type.Type */{

      //@override
      /**
       * See Base.js
       * @ignore
       */
      _subclassed: function(SubTypeCtor, instSpec, classSpec, keyArgs) {

        O.setConst(this.prototype, "_hasDescendants", true);

        var SubInstCtor = keyArgs.instance.constructor;

        // Links SubTypeCtor and SubInstCtor and "implements" instSpec.
        SubTypeCtor._initInstCtor(SubInstCtor, instSpec, keyArgs);

        // Implement the given static interface.
        if(classSpec) SubTypeCtor.implementStatic(classSpec);
      },

      // Links TypeCtor (this) and the given InstCtor together and
      // applies the TypeCtor constructor to its own prototype as a way to initialize it.
      // The constructor receives `instSpec` and ends up extending the prototype with it.
      // The static interface is not touched.
      //
      // NOTE: optionally this receives `keyArgs` as an optimization.
      // `_subclassed` is given a _derived_ `keyArgs`
      // that can/should be passed to `this`(constructor).
      _initInstCtor: function(InstCtor, instSpec, keyArgs) {

        O.setConst(InstCtor, "Type", this);

        this.call(this.prototype, instSpec, keyArgs || {instance: InstCtor.prototype});
      }
    });

    _type = Type.prototype;

    Type
      .implement(AnnotatableLinked)
      .implement(bundle.structured.instance);

    return Type;
  };

  function nonEmptyString(value) {
    return value == null ? null : (String(value) || null);
  }
});
