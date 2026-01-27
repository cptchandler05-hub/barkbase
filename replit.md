# Overview

BarkBase is a web3-native animal rescue donation and discovery platform built with Next.js. The platform prioritizes visibility for overlooked and invisible dogs, particularly from rural shelters, through an AI-powered assistant named "Barkr." The mission is to showcase dogs that are most overlooked—not the most popular or newest—using a custom visibility scoring system.

The application uses the RescueGroups API exclusively for dog data (Petfinder API was discontinued December 2, 2025), Supabase for data persistence, and OpenAI for conversational AI interactions. It also incorporates blockchain features through Coinbase's OnchainKit for web3 donations.

## Key Pages
- `/` - Home page with Barkr AI chat, multi-token donation options (ETH wallet, USDC checkout, token swap), Invisible Dog Spotlight, and donor NFT minting
- `/adopt` - Dog adoption search and browsing with visibility scoring
- `/partners` - Rescue partner profiles and directory
- `/about` - Mission, story, and ways to help (Barkr's origin story, impact data, partner benefits)
- `/raffle` - Fundraising raffle features (currently hidden, preserved for future use)

## Recent Changes (January 2026)
- **CRITICAL**: Migrated to RescueGroups API exclusively (Petfinder API discontinued Dec 2, 2025)
- Created `scripts/sync-dogs-rescuegroups.js` - new RescueGroups-only sync script with diversity filters
- Updated Barkr chat to use Supabase database only (no more Petfinder API calls)
- Synced 1,250+ dogs from RescueGroups with visibility scoring
- Added unique constraint on rescuegroups_id in Supabase
- Added Invisible Dog Spotlight component on home page (rotates daily among top 10 most overlooked dogs)
- Implemented USDC Checkout via Coinbase Commerce (no gas fees)
- Added Token Swap widget for multi-token donation support
- Created Donor NFT minting for appreciation badges
- Updated thank you toast images to support multiple token types (ETH, USDC, etc.)
- Fixed OnchainKit configuration to use CDP_API_KEY_NAME/CDP_PRIVATE_KEY
- Hidden raffle feature from navigation (code preserved)
- Standardized styling with frosted glass cards (bg-white/90 backdrop-blur-sm)
- **Enhanced Sync Script**: Increased pagination to 50 pages (from 20) and diversity filters to 5 pages each (from 2) for maximum nationwide dog coverage
- **Dog Detail Fallbacks**: Added "Contact rescue for details" fallback for Health & Care and Good With sections when RescueGroups data is unavailable
- **OnchainKit Improvements**:
  - Auto-reconnect wallet on page load with `reconnectOnMount={true}`
  - Wallet modal display mode for better UX
  - Token Swap now supports 5 Base tokens: ETH, USDC, DAI, WETH, cbBTC
  - Both "from" and "to" swap fields allow token selection
  - Updated checkout messaging to clarify Apple Pay, Card, and Crypto support
- **Mission Section Fix**: Fixed icon overflow on "Underdogs First" card with `min-w-0` and `truncate` classes

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
- `/api/chat` - Main AI conversation endpoint with Barkr (uses Supabase/RescueGroups data)
- `/api/invisible-dogs` - Returns most overlooked dogs from database
- `/api/partners` - Rescue partners listing endpoint (PostgreSQL-backed)
- `/api/coinbase/create-charge` - USDC checkout charge creation

**AI Integration**:
- OpenAI GPT-4 for conversational AI (Barkr assistant)
- Vercel AI SDK for streaming responses
- Context-aware conversation handling with adoption intent detection
- Memory system for tracking user preferences (location, breed, seen dogs)

**Data Sync Architecture**:
- RescueGroups API is the sole data source (Petfinder discontinued Dec 2, 2025)
- Sync command: `cd animal-rescue-donations && node scripts/sync-dogs-rescuegroups.js`
- Diversity filters to capture invisible dogs: seniors, special needs, large/small dogs, older listings
- No rate limits on RescueGroups API (vs Petfinder's 1,000/day)
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

**Database**: Local PostgreSQL (via Replit Database)
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

- `rescue_partners` table for rescue organization profiles:
  - Basic information (name, slug, location, region)
  - Mission statements (short and long)
  - Contact details (email, phone, website, social media)
  - Media (logo_url, banner_url)
  - Categorization (tags, featured status, sort rank)
  - Petfinder integration (petfinder_org_id)
  - Active status and timestamps

- `rescue_needs` table for tracking rescue organization needs:
  - Associated rescue partner (rescue_id foreign key)
  - Need details (title, description, priority, category)
  - Fundraising info (current/goal amounts, donors count)
  - Fulfillment status and timestamps

**Data Models**:
- Normalized dog records from Petfinder and RescueGroups APIs
- JSONB fields for flexible nested data (photos, tags, contact info)
- Geographic data for location-based searches
- Rescue partner profiles with relational needs tracking

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

**Blockchain/Web3 & Payments**:
- **Coinbase OnchainKit**: Comprehensive web3 toolkit including:
  - ConnectWallet / Wallet components for wallet connection
  - Identity components (Avatar, Name, Address, EthBalance) for donor display
  - Checkout component for USDC donations via Coinbase Commerce
  - Swap component for multi-token support (swap any token to ETH)
  - FundButton for fiat-to-crypto onramping
- **Coinbase Developer Platform (CDP)**: 
  - Uses CDP_API_KEY_NAME and CDP_PRIVATE_KEY for authentication
  - ECDSA (ES256) key-based JWT authentication
  - `/api/coinbase/session` endpoint for session tokens
  - `/api/coinbase/create-charge` endpoint for USDC checkout charges
- **Wagmi v2**: React hooks for Ethereum interactions
- **Viem v2**: TypeScript Ethereum library
- **Ethers.js v6**: Ethereum wallet and contract interactions
- Multi-token donation system: ETH wallet, USDC checkout (no gas), token swap

**NFT Features** (Coming Soon):
- Donor appreciation NFT badges on Base
- `/api/nft/mint-donor-badge` endpoint for minting
- DonorNFTMint component for claiming badges

**Database Connection**:
- Node.js `pg` (PostgreSQL client) for database access
- Connection pooling via pg.Pool
- DATABASE_URL environment variable for connection string
- Drizzle ORM for schema management and migrations

**Utilities**:
- `zipcodes` package for US ZIP code validation and rural area identification
- Fuse.js for fuzzy search capabilities (breed matching)
- dotenv for environment configuration

**Development Tools**:
- ESLint with Next.js config
- TypeScript for type safety
- Node-fetch for server-side HTTP requests (legacy Node environments)