/* =========================================================
   TUX POS — SHARED STATE
   All global data lives here. Loaded before every other
   app script, so every file can read and change it.
   ========================================================= */


/* =========================================================
   CURRENT ORDER / SALES
   ========================================================= */

let currentOrder = [];
let kitchenOrders = [];
let completedSales = [];
let expensesList = [];
let gamiyaOrders = [];


/* =========================================================
   SHIFT DATA
   ========================================================= */

let shiftHistory = JSON.parse(
  localStorage.getItem('tuxShiftHistory') || '[]'
);

let currentShift = JSON.parse(
  localStorage.getItem('tuxCurrentShift') || 'null'
);


/* =========================================================
   MONTHLY BANK + OVERALL EXPENSES
   ========================================================= */

let monthlyFinance = JSON.parse(
  localStorage.getItem('tuxMonthlyFinance') || 'null'
);


function getCurrentMonthKey() {

  const now = new Date();

  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0')
  );

}


function ensureMonthlyFinance() {

  if (
    !monthlyFinance ||
    typeof monthlyFinance !== 'object'
  ) {

    monthlyFinance = {

      monthKey: getCurrentMonthKey(),

      bank: 0,

      overallExpenses: 0,

      overallOrders: 0,

      hurryApp: 0

    };

    localStorage.setItem(
      'tuxMonthlyFinance',
      JSON.stringify(monthlyFinance)
    );

  }


  if (
    typeof monthlyFinance.hurryApp !== 'number'
  ) {

    monthlyFinance.hurryApp =
      Number(monthlyFinance.hurryApp || 0);

    localStorage.setItem(
      'tuxMonthlyFinance',
      JSON.stringify(monthlyFinance)
    );

  }

}


ensureMonthlyFinance();


/* =========================================================
   BACKWARD COMPATIBILITY
   ========================================================= */

if (
  typeof monthlyFinance.overallOrders !== 'number'
) {

  monthlyFinance.overallOrders =
    Number(monthlyFinance.overallOrders || 0);

  localStorage.setItem(
    'tuxMonthlyFinance',
    JSON.stringify(monthlyFinance)
  );

}


if (
  monthlyFinance &&
  typeof monthlyFinance.bank !== 'number'
) {

  monthlyFinance.bank =
    Number(monthlyFinance.monthlyNetSales || 0);

  delete monthlyFinance.monthlyNetSales;

  localStorage.setItem(
    'tuxMonthlyFinance',
    JSON.stringify(monthlyFinance)
  );

}


let orderCounter = Number(
  localStorage.getItem('tuxOrderCounter') || '1'
);


/* =========================================================
   PERMISSIONS / ROLES

   worker   : Cashier + Kitchen Board only
   admin    : all pages, VIEW ONLY
   tuxadmin : all pages, full view + edit
   ========================================================= */

const DEFAULT_TUX_ADMIN_PASSWORD =
  'TuxAdmin#2026';


let adminAccount = JSON.parse(
  localStorage.getItem('tuxAdminAccount') || 'null'
);

let tuxAdminActive = false;

let adminActive = false;


/* =========================================================
   WORKERS DATA
   ========================================================= */

let workersList = JSON.parse(
  localStorage.getItem('tuxWorkersList') || '[]'
);


let activeStaffIds = JSON.parse(
  localStorage.getItem('tuxActiveStaffIds') || '[]'
);


let staffModalMode = 'login';


/* =========================================================
   MENU
   SUPABASE IS NOW THE SOURCE OF TRUTH.
   
   These arrays are populated by:
   
   loadMenuFromSupabase()
   loadExtrasFromSupabase()
   ========================================================= */

let menuItems = {

  sandwiches: [],

  combos: [],

  fries: [],

  hawawshi: [],

  drinks: [],

  dessert: []

};


let extrasItems = [];


const MENU_CATEGORY_LABELS = {

  sandwiches: 'Sandwiches & Burgers',

  combos: 'Combos',

  fries: 'Fries & Loaded',

  hawawshi: 'Hawawshi',

  drinks: 'Drinks',

  dessert: 'Zalabya',

  extras: 'Extras'

};


let draggedIndex = null;

let draggedCategory = null;


/* =========================================================
   STOCK
   ========================================================= */

let stockInventory = {

  meat: {
    name: 'Meat',
    unit: 'kg',
    opening: 15.0,
    current: 15.0,
    min: 3.0
  },

  fries: {
    name: 'Fries',
    unit: 'kg',
    opening: 60.0,
    current: 60.0,
    min: 10.0
  },

  buns: {
    name: 'Mac Bun',
    unit: 'pcs',
    opening: 250,
    current: 250,
    min: 50
  },

  soda: {
    name: 'Soda',
    unit: 'can',
    opening: 100,
    current: 100,
    min: 20
  },

  bacon: {
    name: 'Bacon',
    unit: 'slice',
    opening: 80,
    current: 80,
    min: 15
  },

  water: {
    name: 'Water',
    unit: 'bottle',
    opening: 120,
    current: 120,
    min: 25
  },

  cheese: {
    name: 'American Cheese',
    unit: 'slice',
    opening: 350,
    current: 350,
    min: 70
  }

};


/* =========================================================
   RECIPES
   Stock deduction per menu item.
   Amounts use the stock item's own unit.
   ========================================================= */

const DEFAULT_RECIPES = {

  'Single Smashed Patty': {
    meat: 0.1,
    buns: 1,
    fries: 0.14
  },

  'Double Smashed Patty': {
    meat: 0.2,
    buns: 1,
    fries: 0.14
  },

  'Triple Smashed Patty': {
    meat: 0.3,
    buns: 1,
    fries: 0.14
  },

  'Quatro Smashed Patty': {
    meat: 0.4,
    buns: 1,
    fries: 0.14
  },

  'Single Tuxify': {
    meat: 0.1,
    buns: 1,
    cheese: 1,
    fries: 0.14
  },

  'Double Tuxify': {
    meat: 0.2,
    buns: 1,
    cheese: 2,
    fries: 0.14
  },

  'Triple Tuxify': {
    meat: 0.3,
    buns: 1,
    cheese: 3,
    fries: 0.14
  },

  'Quatro Tuxify': {
    meat: 0.4,
    buns: 1,
    cheese: 4,
    fries: 0.14
  },

  "Johnny's 2 Large Smashed": {
    meat: 0.4,
    buns: 2,
    fries: 0.28
  },


  'single double b': {
    meat: 0.2,
    soda: 1,
    fries: 0.2,
    buns: 1
  },

  'Double Double': {
    meat: 0.5,
    cheese: 4,
    soda: 2,
    buns: 2,
    fries: 0.4
  },

  'Twowawshi': {
    meat: 0.24,
    soda: 2
  },

  'QuadTower': {
    meat: 0.9,
    cheese: 8,
    soda: 2,
    buns: 2,
    fries: 0.4
  },

  'Quad 4': {
    meat: 1.2,
    buns: 4,
    cheese: 12,
    soda: 4,
    fries: 0.56
  },


  'Tux Fries': {
    fries: 0.2,
    meat: 0.05
  },

  'Doppy Fries': {
    fries: 0.2,
    meat: 0.05,
    bacon: 1
  },

  'Classic Fries': {
    fries: 0.14
  },

  'Potato Wedges': {
    fries: 0.14
  },

  'Cheese Fries': {
    fries: 0.14
  },

  'Chili Fries': {
    fries: 0.14
  },

  'Extra Tux Fries': {
    fries: 0.06,
    meat: 0.05
  },

  'Extra Doppy Fries': {
    fries: 0.06,
    meat: 0.05,
    bacon: 1
  },

  'Extra Wedges': {
    fries: 0.14
  },


  'Classic Hawawshi': {
    meat: 0.12
  },

  'Tux Hawawshi': {
    meat: 0.12
  },


  'Soda': {
    soda: 1
  },

  'Water': {
    water: 1
  },


  'Cheese': {
    cheese: 1
  },

  'Bacon': {
    bacon: 1
  },

  'Extra Smashed Patty': {
    meat: 0.1
  },

  'Extra Bun': {
    buns: 1
  }

};


let recipes = JSON.parse(
  JSON.stringify(DEFAULT_RECIPES)
);


/* =========================================================
   MISC UI STATE
   ========================================================= */

let visiblePasswordKeys = {};

let countModalMode = 'start';