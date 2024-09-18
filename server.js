import { createRequestHandler } from "@remix-run/express";
import express from "express";

import dotenv from 'dotenv';
dotenv.config();


const viteDevServer =
    process.env.NODE_ENV === "production"
        ? null
        : await import("vite").then((vite) =>
            vite.createServer({
                server: { middlewareMode: true },
            })
        );

const app = express();
app.use(
    viteDevServer
        ? viteDevServer.middlewares
        : express.static("build/client")
);

const build = viteDevServer
    ? () =>
        viteDevServer.ssrLoadModule(
            "virtual:remix/server-build"
        )
    : await import("./build/server/index.js");

// Route to start the installation process
app.get("/install", (req, res) => {
    const shopName = req.query.shop;
    if (shopName) {
        // const redirectURL = "http://localhost:8482/install/api/callback";
        const redirectURL = `${process.env.BASE_URL}/install/api/callback`;

        // Install URL for app install
        const installUrl =
            "https://" +
            shopName +
            "/admin/oauth/authorize?client_id=" +
            process.env.SHOPIFY_API_KEY +
            "&scope=" +
            process.env.SHOPIFY_SCOPES +
            "&redirect_uri=" +
            redirectURL;

        // Redirect the user to the installUrl
        res.redirect(installUrl);
    } else {
        return res.status(400).send('Missing "Shop Name" parameter!!');
    }
});

// Route to handle Shopify's OAuth callback and create the webhook
app.get("/install/api/callback", async (req, res) => {
    const { shop, hmac, code, timestamp } = req.query;


    if (shop && hmac && code) {
        const accessTokenRequestUrl = "https://" + shop + "/admin/oauth/access_token";
        const accessTokenPayload = {
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code,
        };

        try {
            // Exchange the code for an access token
            const response = await fetch(accessTokenRequestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(accessTokenPayload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error_description || 'Unknown error');
            }

            const data = await response.json();
            const accessToken = data.access_token;

        console.log(`Shop : ${shop}, Code : ${code}, hmac : ${hmac}, token : ${accessToken}, timestamp : ${timestamp}`);
        

            // Redirect to the Shopify admin apps page
            res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);

            // res.redirect('/');

        } catch (error) {
            console.error('Error:', error.message);
            res.status(500).send('An error occurred');
        }
    } else {
        return res.status(400).send("Required parameter missing");
    }
});

app.all("*", createRequestHandler({ build }));

const port = process.env.PORT
app.listen(port, () => {
    console.log(`App listening on http://localhost:${port}`);
});