<script lang="ts">
	import logo from '$lib/images/MasquerAge.png';
	import { DarkMode, Footer, FooterCopyright, FooterLink, FooterLinkGroup, FooterBrand, FooterIcon } from 'flowbite-svelte';
	import { GithubSolid } from 'flowbite-svelte-icons';
	import { page } from '$app/state';
	import '../app.css';
	
	let { children } = $props();
</script>

<div class="flex flex-col min-h-screen">
	<div>
		<DarkMode />
	</div>
	
	<main class="flex-1 flex flex-col p-4 w-full max-w-4xl mx-auto box-border">
		{@render children()}
	</main>
	
	{#if !page.error}
		<Footer footerType="logo">
			<div class="sm:flex sm:items-center sm:justify-between">
				<div class="sm:pb-0 pb-5">
					<FooterBrand href="/" src={logo} alt="MasquerAge Logo" name="MasquerAge" />
				</div>
				<FooterLinkGroup ulClass="flex flex-wrap items-center ml-2 mb-6 text-sm text-gray-500 sm:mb-0 dark:text-gray-400">
					<FooterLink href="/">Home</FooterLink>
					<FooterLink href="/generate-id">Create</FooterLink>
					<FooterLink href="/view-id">View</FooterLink>
					<FooterIcon href="https://github.com/ZenoxisIV/MasquerAge" target="_blank">
						<GithubSolid class="w-6 h-6 mr-4 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white" />
					</FooterIcon>
				</FooterLinkGroup>
			</div>
			<hr class="my-6 border-gray-200 sm:mx-auto dark:border-gray-700 lg:my-8" />
				<div class="flex-1 text-center">
					<FooterCopyright
					spanClass="text-sm dark:text-gray-400 sm:text-center"
					href="https://dcs.upd.edu.ph/"
					target="_blank"
					by="Department of Computer Science. UP Diliman."
					/>
					<p class="text-sm dark:text-gray-400 sm:text-center">
						This project is part of the CS 198/199 Undergraduate Program.
					</p>
				</div>
		</Footer>
	{/if}
</div>