// Module for interacting with the RescueGroups API.
// This module is responsible for making API calls to retrieve animal data.

// Import necessary modules
const axios = require('axios'); // For making HTTP requests
const { cleanAnimal } = require('./cleanAnimal'); // For cleaning and normalizing animal data

// Base URL for the RescueGroups API
const RESCUEGROUPS_API_URL = 'https://api.rescuegroups.org/v5/public/animals';

/**
 * Fetches animal data from the RescueGroups API based on specified filters.
 *
 * @param {object} filters - An object containing various filters for the API request.
 * @param {number} [filters.limit] - The maximum number of animals to retrieve.
 * @param {object} [filters.breed] - Filters related to animal breeds.
 * @param {string} [filters.breed.name] - The name of the breed to filter by.
 * @param {object} [filters.species] - Filters related to animal species.
 * @param {string} [filters.species.name] - The name of the species to filter by.
 * @param {object} [filters.location] - Filters related to animal location.
 * @param {number} [filters.location.distance] - The maximum distance in miles to search for animals.
 * @param {object} [filters.location.coordinates] - The geographic coordinates for the location filter.
 * @param {number} filters.location.coordinates.lat - The latitude of the location.
 * @param {number} filters.location.coordinates.lng - The longitude of the location.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of cleaned animal objects.
 * @throws {Error} If the API request fails or returns an error.
 */
async function getAnimals(filters = {}) {
  const { limit, breed, species, location } = filters;

  // Initialize URLSearchParams to build the query string
  const params = new URLSearchParams();

  // Append limit to parameters if provided
  if (limit) {
    params.append('limit', limit.toString());
  }

  // Append breed filter if provided
  if (breed && breed.name) {
    params.append('filter[breed.name]', breed.name);
  }

  // Append species filter if provided
  if (species && species.name) {
    params.append('filter[species.name]', species.name);
  }

  // Append location filters if provided
  if (location && location.coordinates) {
    // FIXED: Location filter using lat/lng coordinates as required by RescueGroups v5 API
    params.append('filter[latitude]', location.coordinates.lat.toString());
    params.append('filter[longitude]', location.coordinates.lng.toString());
    params.append('filter[distance]', '100'); // 100 mile radius
  }

  try {
    // Make the GET request to the RescueGroups API
    const response = await axios.get(`${RESCUEGROUPS_API_URL}?${params.toString()}`);

    // Check if the response contains data and if there are any errors
    if (response.data && response.data.success && response.data.data) {
      // Clean and normalize the retrieved animal data
      const cleanedAnimals = response.data.data.map(animal => cleanAnimal(animal));
      return cleanedAnimals;
    } else {
      // Throw an error if the API request was not successful or returned no data
      throw new Error(`API Error: ${response.data.message || 'Unknown error'}`);
    }
  } catch (error) {
    // Log the error and re-throw it for further handling
    console.error('Error fetching animals from RescueGroups API:', error.message);
    throw error;
  }
}

// Export the getAnimals function for use in other modules
module.exports = {
  getAnimals,
};