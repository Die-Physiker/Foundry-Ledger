/**
 * A single Ledger in our list of Ledgers.
 * @typedef {Object} Ledger
 * @property {string} id - A unique ID to identify this ledger.
 * @property {string} label - The text of the ledger.
 * @property {int} value - Marks whether the ledger is done.
 * @property {array} contents - List of transactions.
 * @property {string} userId - User who owns this ledger.
 * @property {boolean} isPublic - List of users who can see this ledger.
 */

/**
 * A class which holds some constants for ledger-list
 */
class LedgerList {
  static ID = 'credit-ledger';

  static FLAGS = {
    LEDGERS: 'ledgers'
  }

  static TEMPLATES = {
    LEDGERLIST: `modules/${this.ID}/templates/credit-ledger-list.hbs`,
	LEDGER: `modules/${this.ID}/templates/credit-ledger.hbs`
  }

  static SETTINGS = {
    INJECT_BUTTON: 'inject-button'
  }

  /**
   * A small helper function which leverages developer mode flags to gate debug logs.
   * 
   * @param {boolean} force - forces the log even if the debug flag is not on
   * @param  {...any} args - what to log
   */
  static log(force, ...args) {
    const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

    if (shouldLog) {
      console.log(this.ID, '|', ...args);
    }
  }

  static initialize() {
    this.ledgerListConfig = new LedgerListConfig();
	this.ledgerConfig = new LedgerConfig();
    game.settings.register(this.ID, this.SETTINGS.INJECT_BUTTON, {
      config: true,
      default: true,
      hint: `LEDGER-LIST.settings.${this.SETTINGS.INJECT_BUTTON}.Hint`,
      name: `LEDGER-LIST.settings.${this.SETTINGS.INJECT_BUTTON}.Name`,
      onChange: () => ui.players.render(),
      scope: 'client',
      type: Boolean,
    });
	
	Handlebars.registerHelper("ledgerReverse", (arr) => {
    // reverse() mutates the original array, so first we create a shallow copy using the spread operator.
    const reversed = [...arr].reverse();
    return reversed;
    });
	
	Handlebars.registerHelper("ledgerOwner", (ownerId) => {
    return ((ownerId === game.user.id) || game.user.isGM);
    });
  
    Handlebars.registerHelper("ledgerMath", (...args) => {
    let mathArgs = [...args];
    let mathFunction = mathArgs[0];
    mathArgs.shift();
    mathArgs.pop();
    if (Array.isArray(mathArgs[0])) {
      [mathArgs] = mathArgs;
    }
    mathArgs = mathArgs.map(Number);
    if (typeof Math[mathFunction] === "function") {
      return Math[mathFunction].apply(null, mathArgs);
    }
    // Math doesn't have basic functions, we can account
    // for those here as needed:
    if (typeof mathArgs === "undefined") {
      mathFunction = `${mathFunction} bad args: ${mathArgs}`;
    }
    switch (mathFunction) {
      case "sum":
        return mathArgs.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10), 0);
      case "subtract": {
        const minutend = mathArgs.shift();
        const subtrahend = mathArgs.reduce((a, b) => a + b, 0);
        return minutend - subtrahend;
      }
      case "product": {
        return mathArgs.reduce((a, b) => a * b, 1);
      }
      default:
        return "null";
    }
    });
  }
}


/**
 * Register our module's debug flag with developer mode's custom hook
 */
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(LedgerList.ID);
});


/**
 * Once the game has initialized, set up our module
 */
Hooks.once('init', () => {
  LedgerList.initialize();
});


/**
 * The data layer for our ledger-list module
 */
class LedgerListData {
  /**
   * get all toDos for all users indexed by the ledger's id
   */
  static get allLedgers() {
    const allLedgers = game.users.reduce((accumulator, user) => {
      const userLedgers = this.getLedgersOwnedByUser(user.id);

      return {
        ...accumulator,
        ...userLedgers
      }
    }, {});

    return allLedgers;
  }

/**
   * Gets all of a given user's owned Ledgers
   * 
   * @param {string} userId - id of the user whose Ledgers to return
   * @returns {Record<string, Ledger> | undefined}
   */
  static getLedgersOwnedByUser(userId) {
    return game.users.get(userId)?.getFlag(LedgerList.ID, LedgerList.FLAGS.LEDGERS);
  }

  /**
   * Gets all of a given user's Ledgers for display
   * 
   * @param {string} userId - id of the user whose Ledgers to return
   * @returns {Record<string, Ledger> | undefined}
   */
  static getLedgersForUser(userId) {
	let ledgers = this.allLedgers;
	
	var filter = Object.keys(ledgers).filter(function (key) {
    let entry = ledgers[key];
    console.log(entry.value);
    if (entry.userId === userId || entry.isPublic || game.user.isGM)
        return entry;
	}).reduce( (res, key) => (res[key] = ledgers[key], res), {} );
	
	return filter;
  }

  /**
   * 
   * @param {string} userId - id of the user to add this Ledger to
   * @param {Partial<Ledger>} toDoData - the Ledger data to use
   */
  static createLedger(userId, ledgerData) {
    // generate a random id for this new Ledger and populate the userId
    const newLedger = {
	  value: 0,
	  contents: [],
      label: 'Credits',
      id: foundry.utils.randomID(16),
   //   userIds: [userId],
	  userId,
	  isPublic: true,
      ...ledgerData,
    }

    // construct the update to insert the new Ledger
    const newLedgers = {
      [newLedger.id]: newLedger
    }

    // update the database with the new Ledgers
    return game.users.get(userId)?.setFlag(LedgerList.ID, LedgerList.FLAGS.LEDGERS, newLedgers);
  }

  /**
   * Updates a given Ledger with the provided data.
   * 
   * @param {string} ledgerId - id of the Ledger to update
   * @param {Partial<Ledger>} updateData - changes to be persisted
   */
  static updateLedger(ledgerId, updateData) {
    const relevantLedger = this.allLedgers[ledgerId];

    // construct the update to send
    const update = {
      [ledgerId]: updateData
    }
	//ADD MULTI USER HANDELING
    // update the database with the updated Ledger list
    return game.users.get(relevantLedger.userId)?.setFlag(LedgerList.ID, LedgerList.FLAGS.LEDGERS, update);
  }

  /**
   * Deletes a given Ledger
   * 
   * @param {string} ledgerId - id of the Ledger to delete
   */
  static deleteLedger(ledgerId) {
    const relevantLedger = this.allLedgers[ledgerId];

    // Foundry specific syntax required to delete a key from a persisted object in the database
    const keyDeletion = {
      [`-=${ledgerId}`]: null
    }

    // update the database with the updated Ledger list
    return game.users.get(relevantLedger.userId)?.setFlag(LedgerList.ID, LedgerList.FLAGS.LEDGERS, keyDeletion);
  }

  /**
   * Updates the given user's Ledgers with the provided updateData. This is
   * useful for updating a single user's Ledgers in bulk.
   * 
   * @param {string} userId - user whose ledgers we are updating
   * @param {object} updateData - data passed to setFlag
   * @returns 
   */
  static updateUserLedgers(userId, updateData) {
    return game.users.get(userId)?.setFlag(LedgerList.ID, LedgerList.FLAGS.LEDGERS, updateData);
  }
}

class LedgerConfig extends FormApplication {
	/**
   * @override
   */
	static get defaultOptions() {
		const defaults = super.defaultOptions;
  
		const overrides = {
		  closeOnSubmit: false,
		  submitOnChange: false,
		  width: 600,
		  height: 340,
		  id: 'credit-ledger',
		  template: LedgerList.TEMPLATES.LEDGER,
		  title: 'Credit Ledger',
		  userId: game.userId,
	      ledgerId: -1,
		};
  
		const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
    
    return mergedOptions;
  }
  
  getData(options) {
    const ledger = LedgerListData.allLedgers[options.ledgerId];
	
	console.log(ledger);
	console.log(options.ledgerId);
	
	return {
      value: ledger.value,
	  contents: ledger.contents,
	  label: ledger.label,
    }
  }
  
  /**
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.on('click', "[data-action]", this._handleButtonClick.bind(this));
  }
  
  async _handleButtonClick(event) {
    const clickedElement = $(event.currentTarget);
    const action = clickedElement.data().action;
	const ledger = LedgerListData.allLedgers[this.options.ledgerId];
	
	console.log('Button Clicked!', { this: this, action, clickedElement })
	
	let {value} = this.form[0];	
    const reason = this.form[1].value.concat(' - ' + game.user.name);
	
	if (value !== "") {
      value = parseInt(value, 10);
      if (Number.isNaN(value)) {
        action = "error";
      }
	}
	
    switch (action) {
      case 'add': {
		ledger.contents.push(["Add " + value, reason]);
		ledger.value += value; 
		
		LedgerListData.updateLedger(this.options.ledgerId, ledger);
        this.render();
        break;
      }

      case 'subtract': {
        ledger.contents.push(["Subtract " + value, reason]);
		ledger.value -= value; 
		
		LedgerListData.updateLedger(this.options.ledgerId, ledger);
        this.render();
        break;
      }
	  
	  case 'set': {
	    ledger.contents.push(["Set " + value, reason]);
		ledger.value = value; 
		
		LedgerListData.updateLedger(this.options.ledgerId, ledger);
        this.render();
        break;  
	  }

      default:
        LedgerList.log(false, 'Invalid action detected', action);
    }
  }
}


/**
 * The custom FormApplication subclass which displays and edits Ledgers
 */
class LedgerListConfig extends FormApplication {
  /**
   * @override
   */
  static get defaultOptions() {
    const defaults = super.defaultOptions;

    const overrides = {
      closeOnSubmit: false,
      height: 'auto',
      id: 'credit-ledger',
      submitOnChange: true,
      template: LedgerList.TEMPLATES.LEDGERLIST,
      title: 'Ledger List',
      userId: game.userId,
    };

    const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

    return mergedOptions;
  }

  /**
   * Callback passed to Button Click event listener which handles it
   * 
   * @param {MouseEvent} event - the triggering mouse click event
   */
  async _handleButtonClick(event) {
    const clickedElement = $(event.currentTarget);
    const action = clickedElement.data().action;
    const ledger_Id = clickedElement.parents('[data-ledger-id]')?.data()?.ledgerId;

    LedgerList.log(false, 'Button Clicked!', { this: this, action, ledger_Id });
	console.log('Button Clicked!', { this: this, action, ledger_Id })
    switch (action) {
      case 'create': {
        await LedgerListData.createLedger(this.options.userId);
        this.render();
        break;
      }

      case 'delete': {
        const confirmed = await Dialog.confirm({
          content: game.i18n.localize("LEDGER-LIST.confirms.deleteConfirm.Content"),
          title: game.i18n.localize("LEDGER-LIST.confirms.deleteConfirm.Title"),
        });

        if (confirmed) {
          await LedgerListData.deleteLedger(ledger_Id);
          this.render();
        }

        break;
      }
	  
	  case 'open': {
	    LedgerList.ledgerConfig.render(true, { ledgerId:ledger_Id })
	  }

      default:
        LedgerList.log(false, 'Invalid action detected', action);
    }
  }

  /**
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.on('click', "[data-action]", this._handleButtonClick.bind(this));
  }

  /**
   * @override
   */
  getData(options) {
    return {
      ledgers: LedgerListData.getLedgersForUser(options.userId),
    }
  }

  /**
   * @override
   */
  async _updateObject(event, formData) {
    const expandedData = foundry.utils.expandObject(formData);

    LedgerList.log(false, 'saving', {
      expandedData,
      formData,
    });

    await LedgerListData.updateUserLedgers(this.options.userId, expandedData);
  }
}


Hooks.on('renderPlayerList', (playerList, html) => {
  // if the INJECT_BUTTON setting is false, return early
  if (!game.settings.get(LedgerList.ID, LedgerList.SETTINGS.INJECT_BUTTON)) {
    return;
  }

  // find the element which has our logged in user's id
  const loggedInUserListItem = html.find(`[data-user-id="${game.userId}"]`)

  // create localized tooltip
  const tooltip = game.i18n.localize('LEDGER-LIST.button-title');

  // insert a button at the end of this element
  loggedInUserListItem.append(
    `<button type='button' class='ledger-list-icon-button flex0' title="${tooltip}">
      <i class='fas fa-tasks'></i>
    </button>`
  );

  // register an event listener for this button
  html.on('click', '.ledger-list-icon-button', (event) => {
    const userId = $(event.currentTarget).parents('[data-user-id]')?.data()?.userId;

    LedgerList.ledgerListConfig.render(true, { userId });
  });
});