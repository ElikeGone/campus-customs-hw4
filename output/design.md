# Design Changes (Problem 10)

The site was restyled as an "Old Campus" storefront. Everything below is present in the running site and was checked at phone (375px), tablet (768px), and desktop (1440px) widths.

## 1. A cohesive Yale-inspired visual identity
- **What:** warm ivory "paper" backgrounds, Yale blue (#00356b) for key actions, deep ink navy for dark bands, and a sparing New Haven brick red for accents (labels, underlines, sold-out tags). A CC crest logo, a "Boola Boola" pennant in the hero, and a pennant border above the footer.
- **Why:** the site now feels like a real, authentic campus shop instead of a template, which builds trust for officially licensed merchandise and makes browsing more enjoyable.

## 2. Typography with clear hierarchy
- **What:** Fraunces (serif) for headlines and prices, Inter for body text, and Graduate (varsity lettering) for small labels such as "The shop" and "Featured."
- **Why:** shoppers can scan quickly: headings, prices, and labels stand apart at a glance, and the varsity font adds collegiate character without hurting readability.

## 3. A storefront-style Home page
- **What:** a split hero with a large headline, two calls to action (Shop the collection / Ask our assistant), a facts row (102 styles, XS–XXL, 57 Broadway), and three tilted photo cards of real products. Below: a scrolling strip of styles and occasions, six category tiles with real photos and live counts, four featured products, an assistant promo with clickable starter questions, and three value cards.
- **Why:** the first screen shows real merchandise and a clear next step, and category tiles let shoppers jump straight into what they want, so fewer visitors leave without browsing.

## 4. Better product presentation
- **What:** 73 of 102 catalogue photos had black backgrounds. The backend now serves cleaned copies on white, and the original files are untouched. Product cards show category, name, a two-line description, price, and in-stock size indicators (sold-out sizes are crossed out), plus a "Sold out" badge. Photos zoom slightly and cards lift on hover.
- **Why:** consistent, clean product imagery looks professional, and seeing available sizes on the card saves shoppers from clicking into items they can't buy.

## 5. Clearer navigation
- **What:** a sticky header with an announcement bar, an animated underline for the current page, a "Shop" dropdown listing every category, and an "Ask us" button. On phones and tablets it becomes a slide-down menu that closes after you pick a page. The Shop page has a blue page banner, category chips with counts, and a filter bar that stays pinned while scrolling. The product page has breadcrumbs (Shop / Category / Product).
- **Why:** shoppers always know where they are and can reach any category in one click from any page, which keeps them moving through the catalogue.

## 6. A more useful product page
- **What:** a large framed photo, color swatches, and size buttons you can select ("Size L is sold out right now."). Also an "Ask about this item" button that opens the chat with a matching question already typed in, a "More [category]" link, and a licensing note.
- **Why:** size and stock answers are one tap away, and the chat shortcut turns a hesitation ("is it in my size?") into a conversation instead of an exit.

## 7. A friendlier chat experience
- **What:**
  - a pill-shaped "Ask us" launcher with a gentle pulse
  - a branded header with the crest and a status line ("Checks real sizes & stock")
  - suggested starter questions, which change on product pages ("Is this in stock in medium?")
  - animated typing dots, rounded message bubbles, and a round send button
  - product cards inside messages, plus a side panel on wide screens
  - a full-screen chat on phones, with the side panel and its button hidden
- **Why:** suggestions remove the blank-box problem, and a polished, readable chat encourages shoppers to ask for help, which leads directly to product cards they can open.

## 8. Purposeful motion
- **What:** pages fade in, cards rise in, and the hero headline gets an animated underline. There are also hover lifts, a smooth dropdown, and a slowly floating hero collage. All animation is turned off for users who set their device to reduce motion.
- **Why:** subtle movement makes the site feel responsive and alive without slowing anyone down or bothering motion-sensitive users.

## 9. Polished account pages
- **What:** Log in and Create account use a two-panel layout: a blue panel with the crest and the real benefits of an account (your chat history is saved, you're greeted by name, real-time sizes and stock), next to the form. Success and error messages are clearly colored.
- **Why:** telling shoppers what they get for logging in encourages accounts, which enables the assistant's memory and personalization.

## Testing
- **No sideways scrolling** on Home, Shop, a product page, About, Log in, and Create account at 375px, 768px, and 1440px.
- **Existing features still work:**
  - **Shop filters:** Hoodies + XS in stock + cheapest first showed 21 products.
  - **Search:** combined with filters, it gave the correct result.
  - **Product page:** the Davenport Crewneck showed $58.00 and six size buttons.
  - **Login and chat history:** Test User logged in, and their saved chat history reloaded.
  - **Chatbot:** "Is this in stock in XL?" on the Davenport page answered "20 in stock" with the product card.
  - **Phone menu and chat:** the mobile menu closes after navigating, and the chat opens full screen.
- **Build and lint** pass with no errors.
