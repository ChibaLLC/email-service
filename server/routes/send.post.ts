import { z } from "zod";

const schema = z
	.object({
		from: z
			.string()
			.optional()
			.refine(
				(email) => (email ? validateEmail(email).valid : true),
				"The 'from' email provided is not a sutit email."
			),
		to: z.union([z.string(), z.array(z.string())]),
		subject: z.string(),
	})
	.and(z.union([z.object({ text: z.string() }), z.object({ html: z.string() })]));
export default defineEventHandler(async (event) => {

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
