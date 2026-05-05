import { app } from "./app.js";
import { port } from "./config/env.js";

app.listen(port, () => {
	console.log(`[api] listening on http://localhost:${port}`);
});
