/**
 * Service for handling animal searches and synchronization.
 */
export class SearchService {
  private rescueGroupsSyncLocations: number = 500; // Increased sync locations
  private petfinderSyncLocations: number = 500;

  /**
   * Initializes the SearchService.
   * @param logger - The logger instance.
   * @param rescueGroupsApi - The RescueGroups API client.
   * @param petfinderApi - The Petfinder API client.
   */
  constructor(
    private logger: {
      log: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    },
    private rescueGroupsApi: any, // Replace 'any' with actual API client type
    private petfinderApi: any // Replace 'any' with actual API client type
  ) {}

  /**
   * Syncs animal data from RescueGroups.
   */
  public async syncRescueGroupsData(): Promise<void> {
    this.logger.log('[RescueGroups Sync] Starting data sync...');
    try {
      // Fetch locations to sync from RescueGroups
      const response = await this.rescueGroupsApi.getAnimals({
        limit: this.rescueGroupsSyncLocations,
        // No location-specific parameters needed here as we are syncing broadly
      });

      // Process and store the fetched animal data (implementation details omitted)
      this.logger.log(`[RescueGroups Sync] Fetched ${response.animals.length} animals.`);
      // ... store animals in the database ...
      this.logger.log('[RescueGroups Sync] Data sync completed successfully.');
    } catch (error) {
      this.logger.error(`[RescueGroups Sync Error] Failed to sync data: ${error}`);
    }
  }

  /**
   * Syncs animal data from Petfinder.
   */
  public async syncPetfinderData(): Promise<void> {
    this.logger.log('[Petfinder Sync] Starting data sync...');
    try {
      // Fetch locations to sync from Petfinder
      const response = await this.petfinderApi.getAnimals({
        limit: this.petfinderSyncLocations,
        // Petfinder API might require location parameters even for broad syncs,
        // but we'll keep it general for now.
      });

      // Process and store the fetched animal data (implementation details omitted)
      this.logger.log(`[Petfinder Sync] Fetched ${response.animals.length} animals.`);
      // ... store animals in the database ...
      this.logger.log('[Petfinder Sync] Data sync completed successfully.');
    } catch (error) {
      this.logger.error(`[Petfinder Sync Error] Failed to sync data: ${error}`);
    }
  }

  /**
   * Searches for animals based on provided criteria.
   * @param searchParams - The search parameters.
   * @returns A promise that resolves with the search results.
   */
  public async searchAnimals(searchParams: any): Promise<any[]> {
    this.logger.log('[Search] Starting animal search...');
    const normalizedParams = this.normalizeSearchParams(searchParams);

    // Prioritize RescueGroups search if location is provided and RescueGroups is enabled
    if (
      normalizedParams.location &&
      normalizedParams.latitude &&
      normalizedParams.longitude &&
      this.isRescueGroupsEnabled() // Assuming a method to check if RescueGroups is enabled
    ) {
      this.logger.log(
        `[Search] Searching RescueGroups with location: ${normalizedParams.location} (${normalizedParams.latitude}, ${normalizedParams.longitude})`
      );
      try {
        const rescueGroupsResults = await this.rescueGroupsApi.searchAnimals({
          location: normalizedParams.location, // Pass location string for potential RescueGroups filtering if needed
          latitude: normalizedParams.latitude,
          longitude: normalizedParams.longitude,
          // other params from normalizedParams...
        });
        // If RescueGroups provides results, we might prioritize them or merge them.
        // For now, let's assume we'll try Petfinder if RescueGroups yields nothing.
        if (rescueGroupsResults.animals && rescueGroupsResults.animals.length > 0) {
          this.logger.log(
            `[Search] Found ${rescueGroupsResults.animals.length} animals from RescueGroups.`
          );
          return rescueGroupsResults.animals;
        }
      } catch (error) {
        this.logger.warn(`[Search] RescueGroups search failed: ${error}. Falling back to Petfinder.`);
      }
    }

    // Fallback or primary search on Petfinder
    this.logger.log('[Search] Searching Petfinder...');
    try {
      const petfinderResults = await this.petfinderApi.searchAnimals({
        // Pass relevant parameters to Petfinder API
        ...normalizedParams,
      });
      this.logger.log(`[Search] Found ${petfinderResults.animals.length} animals from Petfinder.`);
      return petfinderResults.animals;
    } catch (error) {
      this.logger.error(`[Search] Petfinder search failed: ${error}`);
      return [];
    }
  }

  /**
   * Normalizes search parameters.
   * @param params - The raw search parameters.
   * @returns Normalized search parameters.
   */
  private normalizeSearchParams(params: any): any {
    const normalized: any = {};

    if (params.breed) {
      normalized.breed = params.breed.toLowerCase();
    }
    if (params.age) {
      normalized.age = params.age.toLowerCase();
    }
    if (params.size) {
      normalized.size = params.size.toLowerCase();
    }
    if (params.gender) {
      normalized.gender = params.gender.toLowerCase();
    }
    if (params.location) {
      normalized.location = params.location.trim();

      // Coordinates removed since RescueGroups is no longer used in user searches
    }
    if (params.organizationId) {
      normalized.organizationId = params.organizationId;
    }
    if (params.animalType) {
      normalized.animalType = params.animalType;
    }

    return normalized;
  }

  /**
   * Checks if RescueGroups integration is enabled.
   * @returns True if enabled, false otherwise.
   */
  private isRescueGroupsEnabled(): boolean {
    // This is a placeholder. In a real application, this would check a configuration setting.
    return true;
  }
}