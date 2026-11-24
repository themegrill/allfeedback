import type { ContentSearchItem } from '@/admin/api/surveys';
import { surveysApi } from '@/admin/api/surveys';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { FileText, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type PickerItem = { id: number; title: string };

interface ContentPickerProps {
	selected:    PickerItem[];
	onChange:    ( items: PickerItem[] ) => void;
	postType:    'page' | 'post';
	placeholder: string;
}

export const ContentPicker = ( {
	selected,
	onChange,
	postType,
	placeholder,
}: ContentPickerProps ) => {
	const [ query,   setQuery   ] = useState( '' );
	const [ open,    setOpen    ] = useState( false );
	const [ dropPos, setDropPos ] = useState<React.CSSProperties>( {} );
	const [ thumb,   setThumb   ] = useState<{ top: number; size: number } | null>( null );

	const wrapperRef  = useRef<HTMLDivElement>( null );
	const inputRef    = useRef<HTMLInputElement>( null );
	const listRef     = useRef<HTMLDivElement>( null );
	const scrollRef   = useRef<HTMLDivElement>( null );
	const sentinelRef = useRef<HTMLDivElement>( null );

	const debouncedQuery = useDebouncedValue( query, 300 );

	const { data, isError, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } =
		useInfiniteQuery( {
			queryKey:        [ 'content-search', postType, debouncedQuery ],
			queryFn:         ( { pageParam } ) =>
				surveysApi.contentSearch( {
					search:    debouncedQuery,
					post_type: postType,
					page:      pageParam as number,
					per_page:  10,
				} ),
			initialPageParam: 1,
			getNextPageParam: ( lastPage, allPages ) => {
				const fetched = allPages.reduce( ( n, p ) => n + p.items.length, 0 );
				return fetched < lastPage.total ? allPages.length + 1 : undefined;
			},
			placeholderData: keepPreviousData,
			enabled:         open,
		} );

	const results = data?.pages.flatMap( ( p ) => p.items ) ?? [];

	// ── Dropdown positioning ─────────────────────────────────────────────────
	const updateDropPos = useCallback( () => {
		if ( ! wrapperRef.current ) return;
		const rect = wrapperRef.current.getBoundingClientRect();
		setDropPos( {
			position: 'fixed',
			top:      rect.bottom + 4,
			left:     rect.left,
			width:    rect.width,
			zIndex:   100001,
		} );
	}, [] );

	useEffect( () => {
		if ( ! open ) return;
		updateDropPos();
		window.addEventListener( 'scroll', updateDropPos, true );
		window.addEventListener( 'resize', updateDropPos );
		return () => {
			window.removeEventListener( 'scroll', updateDropPos, true );
			window.removeEventListener( 'resize', updateDropPos );
		};
	}, [ open, updateDropPos ] );

	// ── Close on outside click ───────────────────────────────────────────────
	useEffect( () => {
		if ( ! open ) return;
		const handle = ( e: MouseEvent ) => {
			const target = e.target as Node;
			if ( ! wrapperRef.current?.contains( target ) && ! listRef.current?.contains( target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', handle );
		return () => document.removeEventListener( 'mousedown', handle );
	}, [ open ] );

	// ── Infinite scroll sentinel ─────────────────────────────────────────────
	const fetchStateRef = useRef( { hasNextPage, isFetchingNextPage, fetchNextPage } );
	useEffect( () => {
		fetchStateRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage };
	}, [ hasNextPage, isFetchingNextPage, fetchNextPage ] );

	useEffect( () => {
		const root     = scrollRef.current;
		const sentinel = sentinelRef.current;
		if ( ! root || ! sentinel ) return;
		const observer = new IntersectionObserver(
			( entries ) => {
				if ( ! entries[ 0 ].isIntersecting ) return;
				const { hasNextPage: has, isFetchingNextPage: fetching, fetchNextPage: fetchNext } =
					fetchStateRef.current;
				if ( has && ! fetching ) void fetchNext();
			},
			{ root, threshold: 0 },
		);
		observer.observe( sentinel );
		return () => observer.disconnect();
	}, [ open, results.length ] );

	// ── Scroll thumb ─────────────────────────────────────────────────────────
	const checkThumb = useCallback( ( el: HTMLDivElement ) => {
		if ( el.scrollHeight > el.clientHeight ) {
			setThumb( {
				top:  el.scrollTop / el.scrollHeight,
				size: el.clientHeight / el.scrollHeight,
			} );
		} else {
			setThumb( null );
		}
	}, [] );

	const scrollAreaRef = useCallback( ( el: HTMLDivElement | null ) => {
		scrollRef.current = el;
		if ( ! el ) return;
		requestAnimationFrame( () => checkThumb( el ) );
		el.addEventListener( 'scroll', () => checkThumb( el ) );
	}, [ checkThumb ] );

	// ── Helpers ──────────────────────────────────────────────────────────────
	const selectedIds = selected.map( ( s ) => s.id );
	const visible     = results.filter( ( item ) => ! selectedIds.includes( item.id ) );
	const isFirstLoad = isFetching && ! isFetchingNextPage && results.length === 0;

	const select = ( item: ContentSearchItem ) => {
		if ( selectedIds.includes( item.id ) ) return;
		onChange( [ ...selected, { id: item.id, title: item.title } ] );
		inputRef.current?.focus();
	};

	const remove    = ( id: number ) => onChange( selected.filter( ( s ) => s.id !== id ) );
	const removeAll = () => { onChange( [] ); setQuery( '' ); };

	// ── Dropdown ─────────────────────────────────────────────────────────────
	const dropdown = open && (
		<div
			ref={ listRef }
			style={ dropPos }
			className="overflow-hidden rounded-xl border border-border/70 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.06)]"
			onMouseDown={ ( e ) => e.preventDefault() }
		>
			{ isFirstLoad ? (
				<div className="flex items-center justify-center py-6">
					<Loader2 className="size-4 animate-spin text-muted-foreground/40" />
				</div>
			) : visible.length === 0 ? (
				<div className="px-4 py-3 text-center">
					<p className="text-[13px] text-muted-foreground/60">
						{ isError
							? __( 'Could not load results. Please try again.', 'allfeedback' )
							: results.length > 0
							? __( 'All results already selected.', 'allfeedback' )
							: query
								? __( 'No results found.', 'allfeedback' )
								: __( 'Type to search…', 'allfeedback' ) }
					</p>
				</div>
			) : (
				<div className="relative">
					<div
						ref={ scrollAreaRef }
						className="max-h-[200px] overflow-x-hidden overflow-y-auto p-1.5"
						style={ { scrollbarWidth: 'none' } }
					>
						{ visible.map( ( item ) => (
							<button
								key={ item.id }
								type="button"
								onClick={ () => select( item ) }
								className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent select-none"
							>
								<div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40 group-hover:border-border/80 group-hover:bg-muted/70 transition-colors">
									<FileText className="size-3 text-muted-foreground/60" />
								</div>
								<span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85">
									{ item.title }
								</span>
							</button>
						) ) }
						{ isFetchingNextPage && (
							<div className="flex items-center justify-center py-2">
								<Loader2 className="size-3.5 animate-spin text-muted-foreground/40" />
							</div>
						) }
						<div ref={ sentinelRef } className="h-px" />
					</div>

					{ /* Subtle scroll track */ }
					{ thumb && (
						<div className="pointer-events-none absolute inset-y-2 right-0.5 w-[3px] rounded-full bg-border/30">
							<div
								className="absolute inset-x-0 rounded-full bg-muted-foreground/20"
								style={ { top: `${ thumb.top * 100 }%`, height: `${ thumb.size * 100 }%` } }
							/>
						</div>
					) }
				</div>
			) }
		</div>
	);

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div ref={ wrapperRef } className="space-y-2">
			{ selected.length > 0 && (
				<div className="flex flex-wrap items-center gap-1.5">
					{ selected.map( ( { id, title } ) => (
						<span
							key={ id }
							className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-2 py-0.5 text-[13px] text-foreground/80"
						>
							<span className="max-w-[150px] truncate">{ title }</span>
							<button
								type="button"
								onClick={ () => remove( id ) }
								className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:text-destructive"
							>
								<X className="size-3" />
							</button>
						</span>
					) ) }
					<button
						type="button"
						onClick={ removeAll }
						className="text-[11px] text-muted-foreground/50 transition-colors hover:text-destructive"
					>
						{ __( 'Clear all', 'allfeedback' ) }
					</button>
				</div>
			) }

			<div className="relative">
				<Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
				<input
					ref={ inputRef }
					value={ query }
					onChange={ ( e ) => setQuery( e.target.value ) }
					onFocus={ () => { updateDropPos(); setOpen( true ); } }
					placeholder={ placeholder }
					className="flex h-10 w-full rounded-lg border border-transparent bg-muted/60 py-1 pl-9 pr-8 text-[14px] text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/10"
				/>
				{ isFetching && ! isFetchingNextPage && (
					<Loader2 className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-foreground/40" />
				) }
			</div>

			{ typeof document !== 'undefined' && createPortal( dropdown, document.body ) }
		</div>
	);
};
