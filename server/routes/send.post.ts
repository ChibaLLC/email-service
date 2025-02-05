import { z } from "zod";

export default defineEventHandler(async (event) => {
	const schema = z
		.object({
			from: z
				.string()
				.optional()
				.refine(
					(email) => (email ? email?.endsWith("sutit.org") : true),
					"The 'from' email provided is not a sutit email."
				),
			to: z.string(),
			subject: z.string(),
		})
		.and(
			z.union([
				z.object({ text: z.string() }),
				z.object({ html: z.string() }),
			])
		);

	const { data, error } = await readValidatedBody(event, schema.safeParse);
	if (error) {
		throw createError({
			statusCode: 400,
			message: error.message,
			data: await readBody(event),
			cause: error.cause,
		});
	}

	const result = (await sendMail(data)) as any;
	return createResponse({
		statusCode: 200,
		data: result,
	});
});
