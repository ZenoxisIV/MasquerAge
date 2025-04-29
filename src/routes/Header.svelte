<script lang="ts">
	import { page } from '$app/stores';
	import logo from '$lib/images/MasquerAge-512x512.png';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
	$: activeUrl = $page.url.pathname;
</script>
  
<Navbar class="bg-primary-50 dark:bg-[#0f1c24] shadow-md">
	<NavBrand href="/">
		<img src={logo} class="me-3 h-6 sm:h-9" alt="Flowbite Logo" />
		<span class="self-center whitespace-nowrap text-xl font-semibold text-gray-900 dark:text-gray-100">MasquerAge</span>
	</NavBrand>
	<NavHamburger />
	<NavUl {activeUrl}>
		<NavLi href="/" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Home</NavLi>
		<NavLi href="/generate-id" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Create</NavLi>
		<NavLi href="/view-id" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">View</NavLi>
	</NavUl>
</Navbar>

<style>

</style>