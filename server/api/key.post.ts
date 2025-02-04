import { v4 } from "uuid";
import { ulid } from "ulid";
export default defineEventHandler(async (event) => {
	const { data, error } = await readValidatedBody(event, emailShema.safeParse);
	if (error) {
		throw createError({
			statusCode: 400,
			message: error.message,
			data: error.errors,
			cause: error.cause,
		});
	}

	const key = `${ulid()}_${v4()}`;
	await $storage.setItem(key, data.email);
	await sendMail({
		to: data.email,
		subject: "Your new email-service API key",
		text: key,
	});
	
	return "OK";
});
