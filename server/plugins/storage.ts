import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";

const storage = createStorage({
	driver: fsDriver({ base: "/tmp" }),
});

declare global {
	var $storage: typeof storage;
}

export default defineNitroPlugin(() => {
	Object.defineProperty(global, "$storage", {
		value: storage,
		writable: false,
		enumerable: true,
		configurable: false,
	});
});
