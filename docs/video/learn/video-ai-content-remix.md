# AI content remix

*Source: https://learn.sessionboard.com/videos/video-ai-content-remix — analysed via `google/gemini-3.6-flash` (OpenRouter) from the Guidde MP4 asset.*

### Chronological Walkthrough

#### [00:00]
**NARRATION:**  
"Welcome to Sessionboard. In this video, we'll show you how to use AI content remix to quickly improve your session titles and descriptions using AI while staying in line with your event's voice and style. Same can be applied for speaker information, including their bios."

**SCREEN:**  
*(Title slide: "SESSIONBOARD" logo, dark blue background, title text "AI Content Remix".)*

---

#### [00:16]
**NARRATION:**  
"First, access the content module and access the remix tab. Remix works for both sessions and speakers. For this demo, we'll remix sessions. First, choose what you want to optimize, like session titles, session descriptions, and optionally tags or tracks."

**SCREEN:**  
*(Navigation path: `Content` -> `Remix`. Screen header: `Remix Sessions & Speakers`. Stepper bar: `1 Configure` [Active], `2 Select Content`, `3 Review Results`, `4 Summary`.)*

*UI Layout details:*
- **Choose content type to optimize:**
  - Radio options: `Sessions` (selected, subtext "Optimize session details and descriptions"), `Speakers` (subtext "Optimize speaker bios and information").
- **Configure Remix -> Remix Options:**
  - Checkbox `Session Titles` (Checked, subtext "Improve titles for better clarity and engagement", field `Character Limit: 255 / 255`).
  - Checkbox `Session Descriptions` (Checked, subtext "Improve descriptions for clarity and audience engagement", field `Character Limit: 5000 / 5000`).
  - Checkbox `Tags` (Unchecked, subtext "Generate relevant tags based on session content").
  - Checkbox `Tracks` (Unchecked, subtext "Suggest categorization tracks for sessions").

---

#### [00:33]
**NARRATION:**  
"Next, set your remix parameters. Pick a tone, like professional or friendly, and add any extra guidance, like make titles more engaging for a marketing audience."

**SCREEN:**  
*(Form scroll down in `1 Configure` step.)*

*UI Layout details:*
- **Remix Parameters:**
  - Label: `Set parameters for how content should be remixed:`
  - Field: `Tone` (Dropdown with selected pill `Professional` and close icon `X`).
  - Label: `Additional Guidance`
  - Textarea: `Add any specific instructions or guidance for the AI...` (Placeholder text, counter `0/1000 Characters`).
- Navigation: `< Back` (Disabled/Greyed), `Next >` (Orange primary button).

---

#### [00:44]
**NARRATION:**  
"Now choose the content you want to update. You can filter sessions by specific fields, or browse and select specific sessions. Remember to click Apply Filters, and then use the Next button to continue to review the results."

**SCREEN:**  
*(Stepper step updated: `2 Select Content` [Active]. Nav path: `Content` -> `Remix` -> Step 2.)*

*UI Layout details:*
- Tabs: `Filter Sessions` (Active), `Browse All Sessions`.
- Filter row: Dropdown `Status`, Dropdown `Is`, Value selector `Accepted` (Green pill badge), remove action `X`.
- Link button: `+ Add filter`.
- Match alert box: Green banner reading `8 sessions match this filter`.
- Action button: `Apply Filters` (Blue).
- Bottom navigation: `< Back`, `Next >`.

---

#### [00:59]
**NARRATION:**  
"Here's the review step. On the left, you'll see the sessions you selected. Click into each one to compare the original content with the AI-optimized version. You'll also see a quick summary of what changed, for example, shortened for clarity or rewritten for tone. If you want another option, click regenerate. When you're happy, click save to apply the update."

**SCREEN:**  
*(Stepper step updated: `3 Review Results` [Active]. Nav path: `Content` -> `Remix` -> Step 3.)*

*UI Layout details:*
- Left sidebar list: Header `Select session to review`, counter `0 of 8 reviewed`.
  - Session items: `SESS-26 Advancing Diversity and Inclusion in Academia...`, `SESS-28 STEM Education for the 21st Century...`, `SESS-32 Defining Your Professional Trajectory`, `SESS-34 Satisfying Student Demand...`, `SESS-39 Graduate STEM Education...`.
- Main comparison workspace:
  - Header: `SESS-26 Advancing Diversity and Inclusion in Academia: The Role of the National Research Mentoring Network`. Navigation pills: `< Previous`, `Next >`.
  - **Title Box:**
    - AI Explanation banner (Blue background, spark icon): Summarizes tone/clarity changes made.
    - Side-by-side comparison grid:
      - `Original`: Read-only text box containing original title.
      - `Optimized`: Read-only text box containing AI-generated title.
    - Actions: `Regenerate` (Outline button), `Save` (Blue button).
  - **Description Box:**
    - AI Explanation banner (Blue background, spark icon): Summarizes structural/clarity changes made.
    - Side-by-side comparison grid: `Original` vs `Optimized`.
    - Actions: `Regenerate`, `Save`.

---

#### [01:22]
**NARRATION:**  
"When you're done reviewing your selected sessions, click finish review."

**SCREEN:**  
*(Bottom navigation bar highlights `Finish Review >` button in orange.)*

---

#### [01:27]
**NARRATION:**  
"The summary page shows everything you reviewed and saved. And that's it, your updated titles and descriptions are now ready to use across your event and portal. And remember, the workflow is the same if you switch from sessions to speakers."

**SCREEN:**  
*(Stepper step updated: `4 Summary` [Active]. Nav path: `Content` -> `Remix` -> Step 4.)*

*UI Layout details:*
- Central Card Header: `Summary`
- Subtext: `Your event content is now professional and consistent, without hours of manual editing.`
- Metric Section: `Optimization Results`
  - Stat card: `Sessions Reviewed` = `1`.
  - Grid metrics:
    - `Session Titles`: Count `0` (Subtext "Improved clarity and engagement").
    - `Session Descriptions`: Count `1` with green checkmark (Subtext "Improved clarity and engagement").
    - `Tags`: Count `0`.
    - `Tracks`: Count `0`.
- Bottom navigation: `Done >` button (Orange).

---

#### [01:42]
**NARRATION:**  
"If you have any questions, feel free to contact our support team. Thank you for choosing Sessionboard."

**SCREEN:**  
*(Outro screen showing Sessionboard logo animation.)*

---

### A. Screen Inventory

1. **AI Content Remix Wizard - Step 1: Configure**
   - **Purpose:** Select target entity (Sessions/Speakers), target fields, character limits, tone, and prompt guidance.
   - **Components:**
     - Stepper header (`1 Configure`, `2 Select Content`, `3 Review Results`, `4 Summary`).
     - Radio group: `Sessions`, `Speakers`.
     - Checkboxes: `Session Titles`, `Session Descriptions`, `Tags`, `Tracks`.
     - Text inputs: `Character Limit` (Titles: 255, Descriptions: 5000).
     - Select dropdown: `Tone`.
     - Textarea: `Additional Guidance` (1000 char max).
     - Buttons: `< Back` (disabled), `Next >`.

2. **AI Content Remix Wizard - Step 2: Select Content**
   - **Purpose:** Filter or select specific records to process through AI.
   - **Components:**
     - Tab control: `Filter Sessions`, `Browse All Sessions`.
     - Filter builder: Dropdowns (`Status`, `Is`), value selector (`Accepted`), `+ Add filter` button.
     - Banner alert: `8 sessions match this filter`.
     - Buttons: `Apply Filters`, `< Back`, `Next >`.

3. **AI Content Remix Wizard - Step 3: Review Results**
   - **Purpose:** Compare original vs. optimized AI suggestions, review rationale, regenerate, or save changes per record.
   - **Components:**
     - Master list sidebar: Session cards, item counter (`0 of 8 reviewed`).
     - Detail view header: Session ID + Title, `< Previous`, `Next >` nav buttons.
     - AI rationale box: Light blue container with spark icon.
     - Side-by-side grid: `Original` text block vs `Optimized` text block.
     - Card actions: `Regenerate`, `Save`.
     - Wizard footer: `Finish Review >` button.

4. **AI Content Remix Wizard - Step 4: Summary**
   - **Purpose:** Display post-processing analytics and counts of updated fields.
   - **Components:**
     - Metric cards: `Sessions Reviewed` counter.
     - Status tiles: `Session Titles`, `Session Descriptions`, `Tags`, `Tracks` with counters and checkmark icons.
     - Primary button: `Done >`.

---

### B. Feature / Capability List

- **Multi-Entity AI Processing:** Supports AI content operations for both Sessions and Speakers.
- **Granular Field Control:** Selectively enable titles, descriptions, tags, or tracks with customizable character limits.
- **Parametric Tone & Guidance:** Pre-set tone selector combined with free-form system prompt inputs (up to 1000 characters).
- **Rule-Based Selection:** Query records dynamically using field status filters or manual browsing.
- **Side-by-Side Comparison Workspace:** Real-time diffing UI displaying original text next to AI suggestions.
- **AI Rationale Generator:** Automated bulleted explanations detailing specific linguistic changes made by the model.
- **Per-Field Regeneration & Commitment:** Granular `Regenerate` and `Save` triggers per attribute card.
- **Batch Processing Summary:** Audit dashboard logging total records modified per attribute category.

---

### C. Data Model Signals

- **Session Entity:**
  - `ID` (e.g., `SESS-26`)
  - `Title` (String, max 255 chars)
  - `Description` (Text, max 5000 chars)
  - `Status` (Enum: `Accepted`, etc.)
  - `Tags` (Array of Strings)
  - `Tracks` (Array of Strings)
- **Speaker Entity:**
  - `Bio` (Text)
  - `Speaker Information` (Attributes implied)
- **AI Remix Job / Parameter Model:**
  - `Target Entity` (`Sessions` | `Speakers`)
  - `Target Fields` (Array: `Titles`, `Descriptions`, `Tags`, `Tracks`)
  - `Tone` (Enum: `Professional`, `Friendly`, etc.)
  - `Guidance Prompt` (Text, max 1000 chars)
  - `Review Status` (Boolean per session)

---

### D. Organizer vs Participant

- **Organizer / Event Admin (100% of video UI):**
  - All screens shown belong exclusively to the event organizer backend (`Sessionboard Conference` portal).
  - Used for administrative content curation, batch editing, and AI optimization prior to public display.
- **Participant / Speaker Side:**
  - Not shown. Public event portal receives updated text downstream once saved by organizers.

---

### E. UX/UI Craft Notes

- **Layout Structure:**
  - Fixed-left navigation sidebar (~220px wide) under event switcher.
  - Form container centered with moderate max-width (~900px) in configuration steps.
  - Two-column split interface in Review step (Sidebar ~300px, Main canvas auto-flex).
- **Color Palette & Visuals:**
  - Primary accents: Deep Blue (`#1E56A0` style) and Bright Orange (`#F96D00` style) for final CTA actions.
  - Status badges: Light green pill background for `Accepted` state and match banners.
  - AI Context Cards: Soft ice-blue background `#EBF3FA` with blue spark iconography.
- **Form Controls:**
  - Top-aligned labels over input boxes.
  - Right-aligned character counter indicators within form control borders.
  - Explicit multi-step wizard stepper component with clear active, completed, and upcoming visual states.