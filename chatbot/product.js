/**
 * Product domain object.
 */
let Product     = function() {};
module.exports  = Product;



/**
 * Builds a Product domain object from a Cortex JSON response (either String, or
 * pre-parsed JSON). Gracefully handles missing zoom data from all elements.
 * 
 * NOTE: Does NOT guarantee that any elements are present.
 */
Product.fromCortexJson = function(json) {
    let itemJson    = convertToObj(json);
    let product     = new Product();

    product.uri          = findUriFromJson(itemJson);
    product.code         = findProductCode(itemJson);
    product.definition   = findProductDefinition(itemJson);
    product.availability = findProductAvailability(itemJson);
    product.price        = findProductPrice(itemJson);
    product.category     = null; // TODO: Fill this out later.

    // FYI: This makes more Cortex calls
    product.bundles      = findProductBundles(itemJson);

    return product;
}




/**
 * Returns true if the availability is set to 'AVAILABLE'
 * @return {boolean} True if availability === available.
 */
Product.prototype.isAvailable = function() {
    return this.availability === 'AVAILABLE'
};






/*
 * ***********************************************
 * P A R S I N G   H E L P E R   F U N C T I O N S
 * ***********************************************
 */
function findUriFromJson(data) {
    try {
        return data.self.href.split('?')[0];
    } catch (err) {
        return null;
    }
}



function findProductCode(itemJson) {
    const data = convertToObj(itemJson);
    let   sku;
    try {
        sku = data._code[0].code;
    } catch (err) {
        sku = null;
    }
    return sku;
};



function findProductDefinition(itemJson)
{
    let definition = {};
    try {
        definition.displayName = itemJson._definition[0]['display-name'];
    } catch (err) {
        definition.displayName = null;
    }

    try {
        definition.details = itemJson._definition[0].details;
    } catch (err) {
        definition.details = [];
    }

    return definition;
};



function findProductPrice(data) {
    let priceObj = {};

    try {
        priceObj.purchasePrice = data._price[0]['purchase-price'];
    } catch (err) {
        // Swallow errors. It doesn't have a price?
    }

    try {
        priceObj.listPrice     = data._price[0]['list-price'];
    } catch (err) {
        // Swallow errors. 
    }
    return priceObj;
};



function findProductAvailability(data) {
    // TODO: Implement the product availibility...
    data = convertToObj(data);
    let availabilityState;
    if (data.hasOwnProperty('_availability')) {
        availabilityState = findAvailibilityFromArray(data);
    }
    return availabilityState;
};
function findAvailibilityFromArray(data) {
    const availabilityArray = data['_availability'];

    for (let i = 0; i < availabilityArray.length; i++) {
        if (availabilityArray[i].state !== undefined) {
            return availabilityArray[i].state;
        }
    }
};




function findProductBundles(data) {
    data = convertToObj(data);
    if (data.hasOwnProperty('_definition._components')) {
        const bundles = data._definition[0]._components[0]._element;
        createBundleArray(bundles).then(
            (bundle) => {
                return bundle;
            });
    } else {
        // bundle doesn't exist for item
        return null;
    }
};
// We need a promise for this call here...
function createBundleArray(bundles) {
    return new Promise((resolve, reject) => {
        const bundleArray = [];
        bundles.forEach((bundle) => {
            const quantity = bundle.quantity;
            const displayName = bundle['display-name'];
            const details = bundle.details;

            const standaloneItemHref = findStandaloneItemFromLinks(bundle.links);
            const elementObj = {
                quantity,
                displayName,
                details,
            };
            bundleArray.push(elementObj);
        });
        resolve(bundleArray);
    });
};
function findStandaloneItemFromLinks(links) {
    for (let i = 0; i < links.length; i++) {
        const currentLink = links[i];
        if (currentLink.rel === 'standaloneitem') {
            return currentLink;
        }
    }
    return null;
};





function convertToObj(data) {
    if (typeof data === 'string') {
        return JSON.parse(data);
    }
    return data;
};