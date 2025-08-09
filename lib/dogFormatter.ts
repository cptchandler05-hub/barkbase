import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDogById, getDogByPetfinderId } from '../api/dogs';
import { DogFormatter } from '../utils/DogFormatter';
import { PetfinderAuth } from '../utils/PetfinderAuth';
import { rescueGroupsAuth } from '../utils/RescueGroupsAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import DogDetails from '../components/DogDetails';

const DogProfilePage = () => {
  const { id } = useParams();
  const [dog, setDog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDogData = async () => {
      try {
        let dogData = null;
        let dogSource = '';

        // Try fetching from database first
        try {
          const response = await getDogById(id);
          if (response && response.data) {
            dogData = response.data;
            dogSource = dogData.api_source || 'database'; // Store source if available
            // If dog is from Petfinder in DB, try to get Petfinder ID to confirm
            if (dogSource === 'petfinder' && dogData.petfinder_id) {
              try {
                await getDogByPetfinderId(dogData.petfinder_id); // Check if Petfinder ID is valid
              } catch (petfinderError) {
                console.warn(`Petfinder ID ${dogData.petfinder_id} is invalid or expired: ${petfinderError.message}`);
                // If Petfinder data is stale, we might need to re-fetch or mark as potentially outdated
                // For now, we'll proceed with the DB data but acknowledge the potential issue
              }
            }
          }
        } catch (dbError) {
          console.error("Error fetching dog from database:", dbError);
          setError("Could not retrieve dog data from our database.");
        }

        // If not found in DB or if DB data is insufficient, try Petfinder directly
        if (!dogData) {
          try {
            // Check if the provided ID might be a Petfinder ID
            const pfDog = await getDogByPetfinderId(id);
            if (pfDog && pfDog.data) {
              dogData = pfDog.data;
              dogSource = 'petfinder';
            }
          } catch (pfError) {
            console.error("Error fetching dog from Petfinder:", pfError);
            // If both DB and Petfinder fail, set the error
            if (!dogData) {
              setError(`Dog with ID ${id} not found.`);
            }
          }
        }

        if (dogData) {
          // Format dog data using DogFormatter
          const formatter = new DogFormatter();
          // Ensure verification badge is set correctly based on source
          const formattedDog = formatter.formatDogForDisplay(dogData, dogSource);
          setDog(formattedDog);
        }

      } catch (err) {
        console.error("Error fetching dog:", err);
        setError(`Failed to load dog profile. ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDogData();
  }, [id]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!dog) {
    return <ErrorMessage message="Dog details not found." />;
  }

  return (
    <div>
      <DogDetails dog={dog} />
    </div>
  );
};

export default DogProfilePage;