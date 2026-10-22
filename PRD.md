# Product Requirements Document (PRD)

## 1. Product Name
**Wedding Photo Finder**

---

## 2. Product Purpose
Wedding albums often contain hundreds or thousands of photos, making it difficult and time-consuming for guests and couples to locate specific moments, outfits, or settings. 

**Wedding Photo Finder** enables users to discover relevant wedding photos quickly by searching for observable visual details (such as clothing color, attire style, accessories, and venue background) rather than relying on biometric facial recognition or manual browsing. Photos stay stored locally in the user's browser, respecting guest privacy.

---

## 3. Target Users
- **Wedding Guests**: Guests looking for photos of themselves, their partners, their family members, or specific groups without having to comb through hundreds of images manually.
- **Couples & Hosts**: Newlyweds wanting to curate photos featuring specific elements (e.g., reception centerpieces, specific floral arrangements, bridesmaids in sage dresses).
- **Wedding Photographers / Event Organizers**: Professionals or hosts who need a lightweight, privacy-conscious gallery tool to showcase albums and help guests retrieve moments of interest.

---

## 4. Core Functionality (What the AI Actually Does)

### 4.1 Observable Visual Attribute Extraction
When photos are analyzed, the AI vision model scans each image for observable physical traits and context only—strictly avoiding biometric facial recognition, identity matching, or personal profiling:
- **Clothing & Outfits**: Colors, cuts, and styles of suits, gowns, ties, and apparel (e.g., "navy blue three-piece suit", "blush pink bridesmaid dress").
- **Objects & Accessories**: Distinct items held or displayed (e.g., champagne flutes, bouquets, sunglasses, floral arch).
- **Background & Setting**: Scene environment and location cues (e.g., outdoor garden altar, candlelit banquet hall, dance floor).
- **Dominant Colors & Scene Type**: Primary color palette and event stage (e.g., "outdoor ceremony", "evening reception dinner").

### 4.2 Attribute-Based Search & Ranking
- **Natural Language Text Search**: Evaluates guest text queries against the analyzed photo attributes and scores matches from 0% to 100%.
- **Reference Image Search**: Accepts a guest-provided photo (such as a selfie or an outfit photo from the event), extracts its visual attributes, and compares them against the album catalog.
- **Category Filtering**: Allows users to focus the AI matching on specific visual dimensions:
  - *Outfit & Clothing*
  - *Objects & Accessories*
  - *Background & Location*
  - *Overall Visual Similarity*
- **Explainable Match Rationale**: Accompanies each ranked result with a human-readable explanation of why the photo matched the query (e.g., "Matched navy blue suit with lapel flower near wooden arbor").

---

## 5. User Flow (Step-by-Step Interaction)

### Step 1: Album Ingestion (Photographer Studio)
1. The user navigates to the **Photographer Studio** tab.
2. The user drags and drops or selects image files (JPG, PNG, WebP) from their computer.
3. Photos are read and stored directly in the browser's local storage (IndexedDB), with immediate thumbnail previews and a live photo counter.
4. The user can review thumbnails, click to inspect any photo, or remove individual/all photos.

### Step 2: Defining Search Criteria (Guest Search)
1. The user switches to the **Guest Search** tab.
2. The user chooses their search modality:
   - **Text Description**: Types natural phrases describing what to look for (e.g., *"guest in a navy suit holding a champagne glass near the floral arch"*).
   - **Reference Image**: Uploads a sample image (e.g., a photo showing their wedding attire).
3. The user selects a **Search Category** dropdown to guide emphasis (*Outfit & Clothing*, *Objects & Accessories*, *Background & Location*, or *Overall Visual Similarity*).

### Step 3: Running AI Search & Viewing Results
1. The user clicks **"Search the album"**.
2. If photos have not yet been processed, the system analyzes them in the background (caching the attributes locally for all future searches).
3. The AI scores and ranks the album photos by relevance.
4. Search results appear sorted from highest to lowest match score, featuring:
   - Match percentage progress bar.
   - Textual rationale highlighting specific matching attributes.
   - Action buttons to **Preview** in full resolution or **Download** the photo.

### Step 4: Full Album Exploration & Lightbox Inspection
1. At any point, the user can switch to the **Full Album** tab to browse the entire collection in an unranked visual grid.
2. Clicking any photo opens an interactive **Lightbox** modal for close inspection and one-click downloading.
