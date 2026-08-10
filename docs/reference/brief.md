# High Level Brief

> swyx's competition brief, reproduced verbatim from the [original Google Doc](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) (formatting cleaned from the doc export; image references point at this repo's `screenshots/` folder). The Google Doc is the authoritative, live version — check it for updates.

Thanks for joining this last min remote hackathon organized out of
[real frustration](https://x.com/swyx/status/2085517544795079014)!

We are looking to replace
[Sessionboard](https://www.sessionboard.com/), which costs
\>\$40k a year:

![Sessionboard marketing site](screenshots/00-sessionboard-marketing-site.png)

We do NOT expect to use everything... Which makes it easier for you to
clone and makes less sense for us to pay.

Primary features we are looking for from **an open source clone that YOU
make (and keep)**:

1. **Custom call-for-speakers submission forms** with conditional logic
   and category-based routing

2. **Self-service speaker portal** for bios, headshots, slides, and
   supporting documents

3. **Automated, templated speaker communications**, including reminders
   and calendar invites delivered directly to each speaker's own
   calendar (Gmail, Outlook, iCal)

4. **Submission evaluation and scoring workflows**, ~~including
   optional AI-assisted review across multiple rounds~~

5. **Drag-and-drop schedule and agenda building**, with automatic
   conflict detection across rooms and tracks, viewable by list, day,
   week, track, or room

6. **Real-time dashboard** showing which speakers still have
   outstanding onboarding tasks

7. ~~Native, one-way integration with Accelevents (our existing
   registration platform) to eliminate manual data in re-entry~~

8. ~~Resource and wiki pages within the speaker portal, including HTML
   embed support for existing reference material~~

9. ~~Embeddable, mobile-friendly speaker gallery and schedule itinerary
   we can post to our website~~

Cloning the exact design is not a requirement; the point is to make a
good-enough open source alternative that we never have to pay for this
closed source SaaS if we can help it.

## (IMPORTANT) Video Walkthrough: platform & requirements

<https://youtu.be/vUuK4Knl7oc>

This is a very hastily recorded walkthrough going thru the requirements
in detail with visual references for your clanker (UPDATE: SEE BELOW FOR
SCREENSHOTS) - we will do a more polished one on Saturday and one on
Sunday morning clarifying requirements based on your feedback, after
which **we will FREEZE** adding any requirements so that you can have
some certainty/polish.

## Discord

<https://discord.gg/XYXaapF4q>
\<- all updates and questions and communication here

## Competition rules

- **Timeline: aim to be done in a weekend, but you may need more time
  esp because we are starting late, so:**

  - **you have until Wednesday Aug 12 10PM PT to submit!**

- Submission involves:

  - Fill out our form we will send out

  - Open source repo with your code

    - so that you walk away with something regardless

  - Deployed site we can test out with the walkthrough shown

- Because so many people signed up, I can't proactively cover tokens,
  but people who SUBMIT valid attempts can ask for **reimbursement
  for up to \$500 in token cost** (will ask for proof, and will
  subjectively judge if there was a real attempt made)

  - This includes people just using their codex pro/claude max
    subscriptions

- The winning submission will:

  - Pass AIE team (not swyx) independent evaluation

  - Tiebreaker will go to whoever has made subjective judgment calls
    for the product that we would actually use/buy

  - **Get \$10,000 cash**

  - **Get on a call to do a walkthrough/interview for writeup on
    latent.space**

- Tech stack:

  - Choose whatever coding agents you want

  - Choose whatever language/tools/frameworks you want

    - Mild bonus points for deploy to Cloudflare infra

    - Bonus points for persistence/DB using Airtable

      - (Because those are what we use on our team)

    - Very teeny bonus points for hosting source code/site on
      [Forge](https://forge.smol.ai/) instead of
      GitHub

      - (because this is my side project)

  - Bonus points for speed/performance

    - we do not want slow SaaS pls

  - Bonus points for API

    - <https://sessionboard.mintlify.app/introduction>

Questions welcome in Discord!
<https://discord.gg/XYXaapF4q>

## SCREENSHOTS

### Basic event config

![Settings hub](screenshots/01-event-config-settings-hub.png)

![Event details](screenshots/01-event-config-event-details.png)

![Exhibitors and sponsors settings](screenshots/01-event-config-exhibitors-sponsors.png)

### Program \> Submission Forms \> Create

![Submission forms list](screenshots/02-form-builder-forms-list.png)

![Form setup steps](screenshots/02-form-builder-setup-steps.png)

![Welcome screen editor](screenshots/02-form-builder-welcome-screen.png)

![Abstract section](screenshots/02-form-builder-abstract-section.png)

![Abstract field list](screenshots/02-form-builder-abstract-field-list.png)

![Participant roles](screenshots/02-form-builder-participant-roles.png)

![Participant fields](screenshots/02-form-builder-participant-fields.png)

![Payments step](screenshots/02-form-builder-payments.png)

![Close date and submission limits](screenshots/02-form-builder-close-date-limits.png)

![Success page and character limits](screenshots/02-form-builder-success-page.png)

![Notifications](screenshots/02-form-builder-notifications.png)

### Public CFP Page looks like this

<https://appv2.sessionboard.com/submit/ai-engineer-sandbox-event/b7d4d7cd-3012-45c2-9c08-a8ee9185182f>

![Public CFP submission page](screenshots/03-public-cfp-submission-page.png)

### Speaker portal after submission

![Speaker portal home](screenshots/04-speaker-portal-home.png)

![Speaker portal profile](screenshots/04-speaker-portal-profile.png)

### Program \> Abstracts

![Abstracts board](screenshots/05-abstracts-review-board.png)

![Inline status editor](screenshots/05-abstracts-review-status-editor.png)

![Column chooser](screenshots/05-abstracts-review-column-chooser.png)

![Import/export options](screenshots/05-abstracts-review-import-export.png)

![Add abstract drawer](screenshots/05-abstracts-review-add-abstract.png)

### Program \> Agenda

![Agenda views](screenshots/06-agenda-calendar-views.png)

### Portal \> Tasks

For speakers to complete after admisssion

![Tasks admin](screenshots/07-portal-tasks-admin.png)

### Portal \> Forms

For speakers to fill out a form in a Task

![Portal forms list](screenshots/08-portal-forms-list.png)

![Create form](screenshots/08-portal-forms-create-form.png)

![Form questions and field library](screenshots/08-portal-forms-questions-library.png)

![Form confirmation email](screenshots/08-portal-forms-confirmation-email.png)

![File requests list](screenshots/08-portal-forms-file-requests.png)

![Add file request](screenshots/08-portal-forms-add-file-request.png)

### CMS \> Embeds (OPTIONAL)

![Embeds list](screenshots/09-cms-embeds-list.png)

![Embed editor](screenshots/09-cms-embeds-editor.png)

### Dashboard (optional but nice to have, best efforts)

![Dashboard: Today](screenshots/10-dashboard-today.png)

![Pacing chart and recent submissions](screenshots/10-dashboard-pacing-recents.png)

![Dashboard alert rows](screenshots/10-dashboard-alerts.png)

![Evaluations dashboard](screenshots/10-dashboard-evaluations.png)

![Speaker tracking dashboard](screenshots/10-dashboard-speaker-tracking.png)

![Submissions pipeline dashboard](screenshots/10-dashboard-submissions-pipeline.png)

![New dashboard modal](screenshots/10-dashboard-new-dashboard-modal.png)
