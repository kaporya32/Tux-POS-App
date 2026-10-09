/* =========================================================
   TUX POS — CATEGORY COLORS SERVICE
   ========================================================= */

window.TUX_CATEGORY_COLORS_SERVICE =
  window.TUX_CATEGORY_COLORS_SERVICE || {};


/* =========================================================
   DEFAULT CATEGORY COLORS
   ========================================================= */

window.TUX_CATEGORY_COLORS_SERVICE.DEFAULT_CATEGORY_COLORS = {

  sandwiches: {
    title_text_color: '#ffffff',
    title_color: '#a8323a',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#e5484d',
    gradient_color: '#000000',
    price_color: '#ff777c',
    border_color: '#ffffff'
  },

  combos: {
    title_text_color: '#ffffff',
    title_color: '#a94f19',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#e4772e',
    gradient_color: '#000000',
    price_color: '#ff9b58',
    border_color: '#ffffff'
  },

  fries: {
    title_text_color: '#ffffff',
    title_color: '#b18a18',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#e5b93f',
    gradient_color: '#000000',
    price_color: '#f5cf68',
    border_color: '#ffffff'
  },

  hawawshi: {
    title_text_color: '#ffffff',
    title_color: '#75472d',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#a96842',
    gradient_color: '#000000',
    price_color: '#d99468',
    border_color: '#ffffff'
  },

  drinks: {
    title_text_color: '#ffffff',
    title_color: '#245f91',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#3b9bd8',
    gradient_color: '#000000',
    price_color: '#6fc1f2',
    border_color: '#ffffff'
  },

  dessert: {
    title_text_color: '#ffffff',
    title_color: '#85447e',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#d866a8',
    gradient_color: '#000000',
    price_color: '#ed8ac1',
    border_color: '#ffffff'
  },

  extras: {
    title_text_color: '#ffffff',
    title_color: '#85447e',
    title_width: 100,
    product_name_color: '#ffffff',
    card_color: '#9b6cff',
    gradient_color: '#000000',
    price_color: '#b99aff',
    border_color: '#ffffff'
  }

};


/* =========================================================
   SERVICE STATE
   ========================================================= */

window.TUX_CATEGORY_COLORS_SERVICE.currentCategoryColors =
  JSON.parse(
    JSON.stringify(
      window.TUX_CATEGORY_COLORS_SERVICE
        .DEFAULT_CATEGORY_COLORS
    )
  );

window.TUX_CATEGORY_COLORS_SERVICE.realtimeChannel =
  window.TUX_CATEGORY_COLORS_SERVICE.realtimeChannel || null;


/* =========================================================
   HELPERS
   ========================================================= */

function tuxCreateSafeCategoryColors(
  category,
  titleTextColor,
  titleColor,
  titleWidth,
  productNameColor,
  cardColor,
  gradientColor,
  priceColor,
  borderColor
) {

  const defaults =
    window.TUX_CATEGORY_COLORS_SERVICE
      .DEFAULT_CATEGORY_COLORS[category];


  if (!defaults) {

    return {

      title_text_color:
        titleTextColor || '#ffffff',

      title_color:
        titleColor || '#000000',

      title_width:
        Number.isFinite(Number(titleWidth)) &&
        Number(titleWidth) > 0
          ? Math.min(100, Number(titleWidth))
          : 100,

      product_name_color:
        productNameColor || '#ffffff',

      card_color:
        cardColor || '#000000',

      gradient_color:
        gradientColor || '#000000',

      price_color:
        priceColor || '#000000',

      border_color:
        borderColor || '#ffffff'

    };

  }


  const parsedTitleWidth =
    Number(titleWidth);


  return {

    title_text_color:
      titleTextColor ||
      defaults.title_text_color,

    title_color:
      titleColor ||
      defaults.title_color,

    title_width:
      Number.isFinite(parsedTitleWidth) &&
      parsedTitleWidth > 0
        ? Math.min(100, parsedTitleWidth)
        : defaults.title_width,

    product_name_color:
      productNameColor ||
      defaults.product_name_color,

    card_color:
      cardColor ||
      defaults.card_color,

    gradient_color:
      gradientColor ||
      defaults.gradient_color,

    price_color:
      priceColor ||
      defaults.price_color,

    border_color:
      borderColor ||
      defaults.border_color

  };

}


/* =========================================================
   LOAD CATEGORY COLORS
   ========================================================= */

async function loadCategoryColors() {

  window.TUX_CATEGORY_COLORS_SERVICE
    .currentCategoryColors =
    JSON.parse(
      JSON.stringify(
        window.TUX_CATEGORY_COLORS_SERVICE
          .DEFAULT_CATEGORY_COLORS
      )
    );


  try {

    const {
      data,
      error
    } = await supabaseClient
      .from('category_colors')
      .select(
        'id, category, title_text_color, title_color, title_width, product_name_color, card_color, gradient_color, price_color, border_color, updated_at'
      );


    if (error) {

      console.error(
        'TUX POS — Failed to load category colors:',
        error
      );

      return window.TUX_CATEGORY_COLORS_SERVICE
        .currentCategoryColors;

    }


    if (Array.isArray(data)) {

      data.forEach((row) => {

        if (!row || !row.category) {
          return;
        }


        window.TUX_CATEGORY_COLORS_SERVICE
          .currentCategoryColors[row.category] =
          tuxCreateSafeCategoryColors(

            row.category,

            row.title_text_color,

            row.title_color,

            row.title_width,

            row.product_name_color,

            row.card_color,

            row.gradient_color,

            row.price_color,

            row.border_color

          );

      });

    }


    console.log(
      'TUX POS — Category colors loaded:',
      window.TUX_CATEGORY_COLORS_SERVICE
        .currentCategoryColors
    );


    return window.TUX_CATEGORY_COLORS_SERVICE
      .currentCategoryColors;


  } catch (error) {

    console.error(
      'TUX POS — Category colors load exception:',
      error
    );


    return window.TUX_CATEGORY_COLORS_SERVICE
      .currentCategoryColors;

  }

}


/* =========================================================
   GET COLORS
   ========================================================= */

function getCategoryColors() {

  return window.TUX_CATEGORY_COLORS_SERVICE
    .currentCategoryColors;

}


/* =========================================================
   SAVE COLORS
   ========================================================= */

async function saveCategoryColors(
  category,
  titleTextColor,
  titleColor,
  titleWidth,
  productNameColor,
  cardColor,
  gradientColor,
  priceColor,
  borderColor
) {

  if (
    typeof getActiveRole === 'function' &&
    getActiveRole() !== 'tuxadmin'
  ) {

    alert(
      'View only - Only Tux Admin can edit category colors.'
    );


    return {
      success: false
    };

  }


  const safeColors =
    tuxCreateSafeCategoryColors(

      category,

      titleTextColor,

      titleColor,

      titleWidth,

      productNameColor,

      cardColor,

      gradientColor,

      priceColor,

      borderColor

    );


  try {

    const {
      data,
      error
    } = await supabaseClient
      .from('category_colors')
      .upsert(

        {

          category:
            category,

          title_text_color:
            safeColors.title_text_color,

          title_color:
            safeColors.title_color,

          title_width:
            safeColors.title_width,

          product_name_color:
            safeColors.product_name_color,

          card_color:
            safeColors.card_color,

          gradient_color:
            safeColors.gradient_color,

          price_color:
            safeColors.price_color,

          border_color:
            safeColors.border_color,

          updated_at:
            new Date().toISOString()

        },

        {
          onConflict:
            'category'
        }

      )
      .select()
      .single();


    if (error) {

      console.error(
        'TUX POS — Failed to save category colors:',
        error
      );


      alert(
        'Failed to save category colors.\n\n' +
        error.message
      );


      return {
        success: false,
        error: error
      };

    }


    window.TUX_CATEGORY_COLORS_SERVICE
      .currentCategoryColors[category] =
      tuxCreateSafeCategoryColors(

        category,

        data
          ? data.title_text_color
          : safeColors.title_text_color,

        data
          ? data.title_color
          : safeColors.title_color,

        data
          ? data.title_width
          : safeColors.title_width,

        data
          ? data.product_name_color
          : safeColors.product_name_color,

        data
          ? data.card_color
          : safeColors.card_color,

        data
          ? data.gradient_color
          : safeColors.gradient_color,

        data
          ? data.price_color
          : safeColors.price_color,

        data
          ? data.border_color
          : safeColors.border_color

      );


    applyCategoryColorsToMenu();


    console.log(
      'TUX POS — Category color saved:',
      window.TUX_CATEGORY_COLORS_SERVICE
        .currentCategoryColors[category]
    );


    return {
      success: true,
      data: data
    };


  } catch (error) {

    console.error(
      'TUX POS — Category colors save exception:',
      error
    );


    alert(
      'Failed to save category colors.\n\n' +
      error.message
    );


    return {
      success: false,
      error: error
    };

  }

}


/* =========================================================
   RESET COLORS
   ========================================================= */

async function resetCategoryColors(category) {

  const defaults =
    window.TUX_CATEGORY_COLORS_SERVICE
      .DEFAULT_CATEGORY_COLORS[category];


  if (!defaults) {

    return {
      success: false
    };

  }


  return await saveCategoryColors(

    category,

    defaults.title_text_color,

    defaults.title_color,

    defaults.title_width,

    defaults.product_name_color,

    defaults.card_color,

    defaults.gradient_color,

    defaults.price_color,

    defaults.border_color

  );

}


/* =========================================================
   APPLY COLORS / SIZES TO MENU
   ========================================================= */

function applyCategoryColorsToMenu() {

  const categories = [

    'sandwiches',
    'combos',
    'fries',
    'hawawshi',
    'drinks',
    'dessert',
    'extras'

  ];


  const cssCategoryMap = {

    sandwiches: 'sandwiches',
    combos: 'combos',
    fries: 'fries',
    hawawshi: 'hawawshi',
    drinks: 'drinks',
    dessert: 'zalabya',
    extras: 'extras'

  };


  categories.forEach((category) => {

    const colors =
      window.TUX_CATEGORY_COLORS_SERVICE
        .currentCategoryColors[category];


    if (!colors) {
      return;
    }


    const cssCategory =
      cssCategoryMap[category] ||
      category;


    const defaultColors =
      window.TUX_CATEGORY_COLORS_SERVICE
        .DEFAULT_CATEGORY_COLORS[category] ||
      {};


    /* =====================================================
       CATEGORY NAME TEXT COLOR
       ===================================================== */

    const titleTextColor =
      colors.title_text_color ||
      defaultColors.title_text_color ||
      '#ffffff';


    /* =====================================================
       CATEGORY BACKGROUND COLOR
       ===================================================== */

    const titleColor =
      colors.title_color ||
      defaultColors.title_color ||
      '#000000';


    /* =====================================================
       CATEGORY WIDTH
       ===================================================== */

    const titleWidth =
      Number(colors.title_width) > 0
        ? Math.min(100, Number(colors.title_width))
        : defaultColors.title_width || 100;


    /* =====================================================
       PRODUCT NAME
       ===================================================== */

    const productNameColor =
      colors.product_name_color ||
      defaultColors.product_name_color ||
      '#ffffff';


    /* =====================================================
       BOX COLOR
       ===================================================== */

    const cardColor =
      colors.card_color ||
      defaultColors.card_color ||
      '#000000';


    /* =====================================================
       GRADIENT COLOR
       ===================================================== */

    const gradientColor =
      colors.gradient_color ||
      defaultColors.gradient_color ||
      '#000000';


    /* =====================================================
       PRICE COLOR
       ===================================================== */

    const priceColor =
      colors.price_color ||
      defaultColors.price_color ||
      '#000000';


    /* =====================================================
       BORDER COLOR
       This is the upper inside strip color.
       CSS ::before uses --category-color.
       ===================================================== */

    const borderColor =
      colors.border_color ||
      defaultColors.border_color ||
      '#ffffff';


    /* =====================================================
       PRODUCT CARDS
       ===================================================== */

    document
      .querySelectorAll(
        `.item-card.category-${cssCategory}`
      )
      .forEach((element) => {

        /* -----------------------------------------------
           MAIN BOX COLOR
           ----------------------------------------------- */

        element.style.setProperty(
          '--category-card-color',
          cardColor
        );


        element.style.setProperty(
          'background-color',
          cardColor,
          'important'
        );


        /* -----------------------------------------------
           UPPER INSIDE STRIP COLOR
           .item-card::before uses --category-color
           ----------------------------------------------- */

        element.style.setProperty(
          '--category-color',
          borderColor
        );


        /* -----------------------------------------------
           GRADIENT
           ----------------------------------------------- */

        element.style.setProperty(
          'background-image',
          `linear-gradient(
            145deg,
            color-mix(
              in srgb,
              ${cardColor} 18%,
              transparent
            ),
            ${gradientColor} 65%
          )`,
          'important'
        );

      });


    /* =====================================================
       CATEGORY HEADER
       ===================================================== */

    document
      .querySelectorAll(
        `.category-title-${cssCategory}`
      )
      .forEach((element) => {

        element.style.setProperty(
          'color',
          titleTextColor,
          'important'
        );


        element.style.setProperty(
          'background',
          titleColor,
          'important'
        );


        element.style.setProperty(
          'background-color',
          titleColor,
          'important'
        );


        element.style.setProperty(
          'width',
          `${titleWidth}%`,
          'important'
        );

      });


    /* =====================================================
       PRODUCT NAME
       ===================================================== */

    document
      .querySelectorAll(
        `.item-card.category-${cssCategory} .item-name`
      )
      .forEach((element) => {

        element.style.setProperty(
          'color',
          productNameColor,
          'important'
        );

      });


    /* =====================================================
       PRODUCT PRICE
       ===================================================== */

    document
      .querySelectorAll(
        `.item-card.category-${cssCategory} .item-price`
      )
      .forEach((element) => {

        element.style.setProperty(
          'color',
          priceColor,
          'important'
        );

      });

  });

}


/* =========================================================
   REALTIME CHANGE HANDLER
   ========================================================= */

function handleRealtimeCategoryChange(row) {

  if (!row || !row.category) {
    return;
  }


  const category =
    row.category;


  if (
    !window.TUX_CATEGORY_COLORS_SERVICE
      .DEFAULT_CATEGORY_COLORS[category]
  ) {

    return;

  }


  window.TUX_CATEGORY_COLORS_SERVICE
    .currentCategoryColors[category] =
    tuxCreateSafeCategoryColors(

      category,

      row.title_text_color,

      row.title_color,

      row.title_width,

      row.product_name_color,

      row.card_color,

      row.gradient_color,

      row.price_color,

      row.border_color

    );


  console.log(
    'TUX POS — Category color updated:',
    row
  );


  applyCategoryColorsToMenu();


  if (
    typeof currentView !== 'undefined' &&
    currentView === 'settings' &&
    typeof renderCategoryColorsSettings === 'function'
  ) {

    renderCategoryColorsSettings();

  }

}


/* =========================================================
   INITIALIZE REALTIME
   ========================================================= */

function initializeCategoryColorsRealtime() {

  if (
    window.TUX_CATEGORY_COLORS_SERVICE
      .realtimeChannel
  ) {

    console.log(
      'TUX POS — Category colors Realtime already initialized.'
    );

    return;

  }


  window.TUX_CATEGORY_COLORS_SERVICE
    .realtimeChannel =
    supabaseClient
      .channel(
        'category-colors-realtime'
      )


      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'category_colors'
        },
        (payload) => {

          handleRealtimeCategoryChange(
            payload.new
          );

        }
      )


      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'category_colors'
        },
        (payload) => {

          handleRealtimeCategoryChange(
            payload.new
          );

        }
      )


      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'category_colors'
        },
        (payload) => {

          const category =
            payload.old &&
            payload.old.category;


          if (!category) {
            return;
          }


          const defaults =
            window.TUX_CATEGORY_COLORS_SERVICE
              .DEFAULT_CATEGORY_COLORS[category];


          if (!defaults) {
            return;
          }


          window.TUX_CATEGORY_COLORS_SERVICE
            .currentCategoryColors[category] =
            JSON.parse(
              JSON.stringify(
                defaults
              )
            );


          console.log(
            'TUX POS — Category color deleted:',
            category
          );


          applyCategoryColorsToMenu();


          if (
            typeof currentView !== 'undefined' &&
            currentView === 'settings' &&
            typeof renderCategoryColorsSettings === 'function'
          ) {

            renderCategoryColorsSettings();

          }

        }
      )


      .subscribe((status) => {

        console.log(
          'TUX POS — Category colors Realtime:',
          status
        );


        if (status === 'SUBSCRIBED') {

          console.log(
            'TUX POS — Category colors Realtime connected.'
          );

        }


        if (status === 'CHANNEL_ERROR') {

          console.error(
            'TUX POS — Category colors Realtime channel error.'
          );

        }


        if (status === 'TIMED_OUT') {

          console.error(
            'TUX POS — Category colors Realtime timed out.'
          );

        }


        if (status === 'CLOSED') {

          console.warn(
            'TUX POS — Category colors Realtime channel closed.'
          );

        }

      });

}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.loadCategoryColors =
  loadCategoryColors;

window.getCategoryColors =
  getCategoryColors;

window.saveCategoryColors =
  saveCategoryColors;

window.resetCategoryColors =
  resetCategoryColors;

window.applyCategoryColorsToMenu =
  applyCategoryColorsToMenu;

window.initializeCategoryColorsRealtime =
  initializeCategoryColorsRealtime;

window.handleRealtimeCategoryChange =
  handleRealtimeCategoryChange;