import { z } from "zod";

export default defineEventHandler((event) => {
	const schema = z
		.object({
			from: z.string().optional(),
			to: z.string(),
			subject: z.string(),
		})
		.and(
			z.union([
				z.object({ text: z.string() }).strict(),
				z.object({ html: z.string() }).strict(),
			])
		);
});
