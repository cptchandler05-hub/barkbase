// Only call Petfinder if database returned very few results (less than 10)
            if (allDogs.length < 10) {
              console.log('[🔍 Petfinder] Database returned only', allDogs.length, 'dogs, searching Petfinder for additional...');
              // 🎯 Search using the priority waterfall search API (Database → Petfinder only)
              const searchRes = await fetch(`${baseUrl}/api/petfinder/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: fullLocation ?? searchLocation ?? '',
                  breed: normalizedBreed ?? '',
                  age: null,
                  size: null,
                  gender: null,
                  limit: 25, // This is the crucial change for the chat context
                  isChat: true, // Add the flag to indicate this is a chat search
                }),
              });