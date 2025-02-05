<template>
	<UContainer>
		<Title>Mailer</Title>
		<div class="absolute w-full h-full radial-gradient top-0 left-0"></div>
		<Transition mode="out-in">
			<div v-if="success" class="h-screen flex flex-col mx-auto">
				<article tag="article" class="h-fit bg-white/75 dark:bg-white/5 backdrop-blur p-4">
					<h2>Usage:</h2>
					<code>
						<pre>

const response = await fetch("https://thedomain/send", {
	method: "POST",
	body: JSON.stringify({
			from: "optional@sutit.org",
			to: "an@email.com",
			text: "plain text message or", html: "a html template"
		})
})
						</pre>
					</code>
				</article>
			</div>
			<div class="h-screen grid place-items-center" v-else>
				<div
					class="rounded-xl divide-y divide-gray-200 dark:divide-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 shadow max-w-sm w-full bg-white/75 dark:bg-white/5 backdrop-blur h-fit mx-auto -mt-60"
				>
					<div class="px-4 py-5 sm:p-6">
						<div class="text-center">
							<div class="pointer-events-none">
								<Icon
									name="material-symbols-light:mail-outline"
									class="w-8 h-8 flex-shrink-0 text-gray-900 dark:text-white"
								/>
							</div>
							<div class="text-xl text-gray-900 dark:text-white font-bold capitalize">
								email service
							</div>
						</div>
						<UForm
							:schema="emailShema"
							:state="state"
							class="space-y-4 mt-2"
							@submit="onSubmit"
						>
							<UFormGroup
								label="Email"
								name="email"
								help="Type in your sutit email, an API key will be sent there"
							>
								<UInput v-model="state.email" />
							</UFormGroup>
							<UButton
								type="submit"
								block
								:loading="loading"
								loading-icon="line-md:loading-loop"
							>
								Submit
							</UButton>
						</UForm>
					</div>
				</div>
			</div>
		</Transition>
	</UContainer>
</template>
<script setup lang="ts">
import { z } from "zod";
import type { FormSubmitEvent } from "#ui/types";

const state = reactive({
	email: undefined,
});

type Schema = z.output<typeof emailShema>;
const loading = ref(false);

const success = ref(false);
const toast = useToast();
async function onSubmit(event: FormSubmitEvent<Schema>) {
	loading.value = true;
	const response = await $fetch("/api/key", {
		method: "POST",
		body: { email: event.data.email },
	}).catch((e) => {
		toast.add({
			icon: "material-symbols:error-outline-rounded",
			title: "An error occurred",
			description: unWrapFetchError(e.data),
			color: "rose",
		});
	});

	if (response) {
		toast.add({
			title: "Email sent!",
			timeout: 0,
			actions: [
				{
					label: "Open Mail",
					click: () => navigateTo("https://webmail.sutit.org/", { external: true }),
				},
			],
			icon: "logos:cpanel",
		});
		success.value = true;
		sessionStorage.setItem("__MAIL_KEY__success", "true");
	}

	loading.value = false;
}

onMounted(() => {
	const value = sessionStorage.getItem("__MAIL_KEY__success");
	success.value = value === "true" ? true : false;
});
</script>
<style>
.radial-gradient {
	background: radial-gradient(50% 50% at 50% 50%, rgb(56 189 248 / 0.1) 0, rgb(3 7 18));
}

.v-enter-active,
.v-leave-active {
	transition: opacity 0.5s ease;
}
.v-enter-from,
.v-leave-to {
	opacity: 0;
}
</style>
