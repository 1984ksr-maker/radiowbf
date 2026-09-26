# RadioWBF website

The new home of WeAreBornFree Community Radio. It is fast, it costs nothing to host, and it keeps playing while people browse.

## What the site does

**Live radio that never stops.** The Live button and player at the top of every page stay alive when people move between pages, just like Montez Press Radio and Radio Kapitał. Three channels: the main studio on Airtime Pro, Subversive Radio and reboot.fm.

**Now playing and schedule, automatically.** Channel 1 asks Airtime every 30 seconds what is on. The schedule page reads the studio calendar straight from Airtime, so you only ever plan shows in one place.

**An archive that fills itself.** Every show you upload to Mixcloud appears in the archive on the next rebuild. SoundCloud shows are added with a simple link. Pressing play opens the show under the Live button, and it keeps playing while you browse.

**No cookies, no tracking, fonts served from the site itself** (no Google Fonts), which keeps things simple with German privacy law.

**Its own dashboard** at radiowbf.de/admin, so anyone in the collective can add a show or change any text, the logo or the colours without touching code.

## What it costs

| Item | Where | Price |
| --- | --- | --- |
| Hosting | Cloudflare Pages, free plan | 0 € |
| Code storage and history | GitHub, free plan | 0 € |
| Dashboard | Sveltia CMS, built in at /admin | 0 € |
| Domain radiowbf.de | Porkbun or INWX | about 2.90 US$ the first year, then about 4 US$ a year |
| Live stream | Airtime Pro (you already have it) | unchanged |

## Going live, step by step

1. **Make a free GitHub account** at github.com and create a new repository called `radiowbf`. Upload all the files from this folder (drag and drop works on the GitHub website).
2. **Make a free Cloudflare account** at dash.cloudflare.com. Go to Workers & Pages, choose Create, then Pages, then Connect to Git, and pick the `radiowbf` repository.
3. **Build settings.** Framework preset: Astro. Build command: `npm run build`. Output folder: `dist`. Under Environment variables add `NODE_VERSION` with the value `22`. Press Save and Deploy. After a minute or two the site is online at an address like `radiowbf.pages.dev`. Check everything there first.
4. **Connect your domain.** Buy `radiowbf.de` at Porkbun (about 2.90 US$ the first year, then about 4 US$ a year). Cloudflare cannot sell .de addresses, so the domain lives at Porkbun and only points to Cloudflare. Then in Cloudflare choose **Add a domain**, type `radiowbf.de`, pick the **Free** plan, and Cloudflare shows two nameserver addresses. Paste those at Porkbun under the domain's **Nameservers** and save. After that, open the Pages project, go to **Custom domains** and add `radiowbf.de` and `www.radiowbf.de`.
   * The old address wearebornfree.de stays with WordPress.com. In its WordPress.com domain settings you can forward it to radiowbf.de, so old links still work.
5. **Fill in the Impressum and Datenschutz pages.** Every German website needs them. The templates list the services this site really uses. Replace everything in square brackets, and have it checked if you can.

## The dashboard (no code)

The website has its own dashboard at **radiowbf.de/admin**. Everything is edited there in simple forms: shows, pages, the logo, the colours, the live inputs and every word of the interface.

**Setting it up once:**

1. The dashboard already points to the repository `1984ksr-maker/radiowbf`. If you ever move it, change that name in `public/admin/config.yml`.
2. Open **yoursite/admin** and press **Sign In Using Access Token**. The dashboard shows a link to GitHub that makes the token with the right permissions already ticked. Create it, copy it, paste it in. Done.
3. Everyone in the collective who edits the site needs a free GitHub account, added as a collaborator on the repository, and their own token.

**What you find in the dashboard:**

* **Shows**: every show is one entry. Press New, fill in the title, date, picture, text and a SoundCloud or Mixcloud link. Tick **Featured** to put it in the big slider.
* **Pages**: About, Support, Impressum and Datenschutz.
* **Station settings**: the logo, the colours, the live inputs, the texts of the start page, the supporter block, the footer, the Instagram and SoundCloud connections, and **Interface words**, where every button and label can be changed or translated.

Press **Save** and the website updates by itself in about a minute.

## Live inputs: switching the player

You can have as many live inputs (stream addresses) as you like. They all appear in the player on the start page and on the Player page, each with its own play button.

1. Open the editor and go to **Station settings**, then **Live inputs (players)**.
2. To add an input, press Add and fill in a name, a small line under it, and the stream address.
3. Tick **On air now** on the input you are live with today, and untick it on the others. That input becomes the big player, and the Live button at the top starts it.
4. Untick **Show on the website** to hide an input for a while without deleting it.
5. If you like, write a line in **Short live note**, for example "Tonight we broadcast together with reboot.fm." Leave it empty to hide it.
6. Press Save. The site updates in about a minute.

Now playing information comes from Airtime, so tick **Show now playing from Airtime** only on inputs that run through your Airtime account.

The **Open the player in its own window** button opens a small separate player window that keeps playing while people use other websites.

## SoundCloud uploads appear by themselves

Every new track you upload to the RadioWBF SoundCloud account becomes a post on the website by itself: its own page with the SoundCloud artwork as the main picture, the description as the text, and a big play button. It also appears among the four newest shows and in the big slider on the start page. No typing needed.

* The site reads your public SoundCloud feed. Your account number is already filled in (**SoundCloud user number** in Station settings).
* New uploads arrive with the next rebuild. Set up the daily rebuild below and they appear every morning. Saving anything in the dashboard also rebuilds the site.
* Single tracks appear, playlists do not. Upload each show as its own track.
* In each track's settings on SoundCloud, **Include in RSS feed** must stay switched on (it is on by default).
* If you also make a show entry with text and photos in the dashboard and paste the same SoundCloud link, the two become one.

## Instagram posts appear by themselves

Your six latest Instagram posts appear on the start page and update by themselves whenever you post.

1. Make a free account at **behold.so** and connect the RadioWBF Instagram account.
2. Create a feed and choose **JSON**. Copy the feed address it gives you.
3. Paste it in the dashboard under **Station settings > Instagram feed address**. Save.

The free Behold plan shows up to six posts, which is exactly what the start page uses. While the field is empty, the Instagram band is hidden.

## The Mixcloud archive

1. In Station settings, type your Mixcloud username into **Mixcloud username**, exactly as it appears in your Mixcloud address (mixcloud.com/**username**/).
2. From then on every Mixcloud upload joins the archive automatically, with its artwork and tags.
3. To refresh the archive every morning (this also picks up new SoundCloud tracks) without anyone lifting a finger: in Cloudflare Pages open Settings, Builds, Deploy hooks, create a hook and copy its address. In GitHub open Settings, Secrets and variables, Actions, and add a secret called `CF_DEPLOY_HOOK` with that address. The included daily rebuild does the rest.

If a show also has its own page with text and photos, paste the same Mixcloud link into that show, and the two will be joined into one entry.

## The look

Black and white like a flyer wall, with the orange of the RadioWBF logo for everything live. It takes ideas from Noods Radio (black running bands and the schedule with day buttons), Palanga Street Radio (schedule and webchat side by side) and Vers Libre (the supporter page).

* The start page: a full width picture slider, the four newest shows, the schedule next to the webchat, the open call poster, the list of live inputs and the supporter block.
* All colours can be changed in the editor under **Station settings > Colours**, or at the top of `src/styles/global.css`.
* The font is Space Grotesk, and Sinhala uses Noto Sans Sinhala. Both are served from the site itself, not from Google.
* The big slider shows shows marked **Featured** first, then the newest ones, four at most.
* The webchat box shows your existing chat page. If you make a version of it with only the chat, put its address in **Chat address**.

## Become a supporter

The supporter block on the start page and the Support page are edited in the dashboard (**Station settings > Supporter block** and **Support page**). Put your donation link (PayPal, Steady or your bank page) in **Donation link**. While it is empty, the button opens the Support page.

## Airtime show names

The now playing text and the schedule show your Airtime show names exactly as they are written there. To change how they read on the website, rename the show in Airtime.

## For developers

```
npm install
npm run dev      # local preview at http://localhost:4321
npm run build    # builds the site into dist/
```

Built with Astro. The page structure:

* `src/pages/` holds the pages: start, schedule, archive, show pages, about, chat and the legal pages
* `src/components/SiteHeader.astro` and `src/lib/player.ts` hold the header with the persistent player
* `src/components/WeekSchedule.astro` holds the week schedule read from Airtime
* `src/lib/mixcloud.ts` holds the Mixcloud import
* `src/content/shows/` holds one Markdown file per show
* `src/data/site.json` holds the station settings
