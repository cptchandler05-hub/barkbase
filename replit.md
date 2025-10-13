# Overview

BarkBase is a web3-native animal rescue donation and discovery platform built with Next.js. The platform prioritizes visibility for overlooked and invisible dogs, particularly from rural shelters, through an AI-powered assistant named "Barkr." The mission is to showcase dogs that are most overlooked—not the most popular or newest—using a custom visibility scoring system.

The application integrates multiple rescue APIs (Petfinder and RescueGroups), uses Supabase for data persistence, and leverages OpenAI for conversational AI interactions. It also incorporates blockchain features through Coinbase's OnchainKit for web3 donations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: Next.js 14/15 with TypeScript and App Router
- React 18/19 for UI components
- Tailwind CSS v4 for styling with custom DM Sans font family
- Framer Motion for animations
- Canvas Confetti for celebration effects
- React Hot Toast for notifications
- React Markdown with rehype-raw and remark-gfm for rich text rendering

**State Management**:
- TanStack React Query v5 for server state management
- React hooks for local component state
- Wagmi for blockchain/wallet state

**UI Components**:
- Lucide React for icons
- Custom components for dog cards, search filters, and chat interface
- Mobile-optimized responsive design

## Backend Architecture

**API Routes** (Next.js API Routes):
- `/api/chat` - Main AI conversation endpoint with Barkr
- `/api/petfinder/search` - Petfinder API integration for dog searches
- Additional rescue API integrations for RescueGroups

**AI Integration**:
- OpenAI GPT-4 for conversational AI (Barkr assistant)
- Vercel AI SDK for streaming responses
- Context-aware conversation handling with adoption intent detection
- Memory system for tracking user preferences (location, breed, seen dogs)

**Data Sync Architecture**:
- Background scripts for syncing dog data from multiple APIs
- Dual-source strategy: RescueGroups (rural/invisible dogs) + Petfinder (urban rescue)
- Deduplication logic across API sources
- Visibility scoring algorithm to prioritize overlooked dogs

**Visibility Scoring System**:
- Custom algorithm calculating dog "invisibility" based on:
  - Time listed
  - Rural location weighting
  - Skip/interaction count
  - Special needs status
  - Age and size factors
- Higher scores indicate more overlooked dogs

## Data Storage

**Database**: Supabase (PostgreSQL)
- `dogs` table with comprehensive dog profiles including:
  - Multi-source support (api_source: petfinder/rescuegroups)
  - Breed information (primary, secondary, mixed status)
  - Physical attributes (age, gender, size, coat, colors)
  - Status flags (spayed/neutered, house trained, special needs)
  - Environment compatibility (children, dogs, cats)
  - Location data (city, state, postcode, coordinates)
  - Photos and tags (stored as JSONB)
  - Contact information (JSONB)
  - Visibility scoring fields
  - Timestamps for tracking updates

**Data Models**:
- Normalized dog records from Petfinder and RescueGroups APIs
- JSONB fields for flexible nested data (photos, tags, contact info)
- Geographic data for location-based searches

## External Dependencies

**Third-Party APIs**:
- **Petfinder API v2**: Primary source for urban/metropolitan rescue dogs
  - OAuth2 token management with automatic refresh
  - Rate limiting and quota management
  - Full animal details fetching with descriptions
  
- **RescueGroups API v5**: Secondary source focusing on rural/invisible dogs
  - REST API with query parameter filtering
  - Includes animal, breed, color, location, and organization data
  - Relationship-based data structure with included entities

- **OpenAI API**: Powers Barkr AI assistant
  - GPT-4 model for natural language understanding
  - Streaming responses for real-time interaction
  - Intent detection (adoption vs general queries)
  - Breed and location extraction from user input

- **Mapbox Geocoding API** (optional): Location coordinate resolution for geographic searches

**Blockchain/Web3**:
- **Coinbase OnchainKit**: Web3 wallet integration and onchain interactions
- **Wagmi v2**: React hooks for Ethereum interactions
- **Viem v2**: TypeScript Ethereum library
- **Ethers.js v6**: Ethereum wallet and contract interactions

**Supabase Services**:
- PostgreSQL database hosting
- Real-time subscriptions (potential use)
- Service role key for admin operations

**Utilities**:
- `zipcodes` package for US ZIP code validation and rural area identification
- Fuse.js for fuzzy search capabilities (breed matching)
- dotenv for environment configuration

**Development Tools**:
- ESLint with Next.js config
- TypeScript for type safety
- Node-fetch for server-side HTTP requests (legacy Node environments)