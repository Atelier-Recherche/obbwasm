![[logo.png]]

# Un guide pour télécharger

Le but de ce guide est de balayer toutes les étapes pour télécharger en 2025 sur Internet des films, séries, logiciels et les livres numériques. Ce texte essaie d'être accessible au néophyte, le sujet étant vaste et parfois complexe un grand nombre de détails seront en annexe pour ne pas alourdir la lecture. Néanmoins, si vous vous intéressez au sujet, je vous recommande de les lire ainsi que de ne pas hésiter à creuser chaque sujet. Toutes les « technologies » utilisées, d'Internet au « peer to peer » en passant par les protocoles divers et variés, ont des pages Wikipédia très complètes…

# BitTorrent c'est quoi ?

BitTorrent est un protocole qui sert à transférer des données pair à pair (P2P) à travers un réseau informatique. Il a été créé en 2001. C'est un réseau d'échange décentralisé dans lequel toutes les personnes partageant un fichier sont à la fois émettrices et réceptrices de l'information. Pour utiliser le protocole BitTorrent, il vous faut un logiciel couramment nommé "client torrent" et un fichier « .torrent^[Une extension de nom de fichier (ou simplement extension de fichier, voire extension) est un suffixe de nom de fichier fait pour identifier son format. Par exemple « nondufichier. torrent » (il en existe autant que de format de fichier : .doc, .txt ,.avi ,.mkv, etc.) Windows et Mac OS ne les affichent pas par défaut, il faut faire un réglage (différent pour chaque système et version, je vous laisse chercher…).] » de très petite taille (quelques ko) ou un lien « magnet^[qui ressemble à cela en brut : `magnet:xt=urn:btih:62c906369f369a1e7368fea95c76cb59957a0577&dn=Bad.Boys.for.Life.2020.1080p.WEBDL.DD5.1.H264FGT&tr=http%3A%2F%2F_tracker_._tracker_fix.com%3A80%2Fannounce&tr=udp%3A%2F%2F9.rarbg.me%3A2770&tr=udp%3A%2F%2F9.rarbg.to%3A2950)`] »  qui va permettre au logiciel de contacter les personnes qui recherchent ou possèdent le même fichier par l'intermédiaire d'un serveur traqueur BitTorrent.

L'idée du lien ou du fichier est de donner "l'emplacement" d'un point de rencontre sur Internet où des personnes échangent ledit fichier (film, etc.). À partir de là, le logiciel que vous utilisez va commencer à récupérer des bouts du fichier progressivement et partager ce que vous avez déjà téléchargé.

Les logiciels les plus classiques sont :
- https://transmissionbt.com/
- https://deluge-torrent.org/

Et pour le cas d'une seedbox^[Une seedbox (que l'on pourrait traduire approximativement par « machine de partage ») est un serveur informatique privé qui est destiné à la réception (téléchargement ou download) et à l'émission (téléversement ou upload) de fichiers informatiques. ], Rutorrent (<https://framalibre.org/content/rutorrent>) que vous commanderez depuis votre navigateur Internet.

Ce guide parle surtout du téléchargement en _torrent_ mais un certain nombre de remarques sont valables sur les autres techniques de téléchargement.

![[Brochure/imagetelechargement/illustre1.png]]
Petit schéma de l’internet^[On dit « internet », mais c’est un abus de langage, il faudrait dire les internets qui est donc un agrégat de plein de réseaux... Dans lequel chacun est identifié par son « IP ». L’adresse IP est une suite de chiffres (ou de caractères pour l’IPV6) qui vous identifie sur un réseau. Cela peut-être sur un réseau local (dans une maison, université, entreprise) ou dans internet(s)…] mondial

# Avant de télécharger, la discrétion

Le téléchargement de contenu protégé par le droit est en France illégal et la ~~HADOPI~~^[Haute Autorité pour la diffusion des œuvres et la protection des droits sur Internet.] qui n'existent plus mais sa mission a été désormmé donnée a l'Arcom^[Autorité de régulation de la communication audiovisuelle et numérique].

Cette autorité gouvernementale infiltre les réseaux de partages illégaux notamment torrent et choisit les fichiers les plus populaires pour surveiller qui les partage. Une fois les adresses IP des téléchargeurs récupérées, elle envoie d'abord une lettre pour dire que ce n'est pas bien. Et si vous continuez, cela se corse…^[https://www.numerama.com/politique/129728-hadopi-faq-savoir.html] observe Internet pour essayer de vous envoyer des prunes. Donc regardez d'abord si le film n'est pas sur YouTube, Vimeo (vous pouvez être surpris et vous pourrez les télécharger avec divers outils expliqués en [[## Les téléchargeurs de sites de streaming|annexe]]... Dans le cas des œuvres indépendantes, vous pouvez aussi envoyer un petit mail à l'auteur dudit film, beaucoup répondent cordialement surtout s'il n'y a pas de DVD en vente...

Bon, mais voilà, dans le cas où il vous faut télécharger, vraiment, alors tout d'abord l'Arcom a tendance à ne s'occuper que des films qui rapportent donc le film indépendant perdu, a priori vous êtes tranquille. Par contre si vous êtes contraint de télécharger Game of Thrones pour des raisons indépendantes de votre volonté, cela va être beaucoup plus risqué. Dans ce cas il y a plusieurs solutions pour masquer votre IP :

- le VPN

Le VPN va faire un tunnel entre votre connexion et celle du serveur du VPN vous permettant ainsi d'être relativement anonyme et d'apparaître connecté dans un autre pays.

Alors dans la plupart des cas c'est payant, mais certains sont gratuits et laissent l'usage du torrent, pas tous, mais protonvpn ou riseupvpn aujourd'hui fonctionnent (à noter que pour riseup, ça leur coûte de l'argent et c'est un projet militant donc essayez de ne pas en abuser…)

Le principal est donc de ne pas faire apparaître votre adresse IP française de votre maison pour HADOPI. Le meilleur moyen de tester si votre VPN fonctionne est de passer par https://ipleak.net/.

![[Brochure/imagetelechargement/illustre3.png]]
## Petit dessin de la HADOPI


#### En gros la HADOPI vient sur le réseau torrent et « partage » un film avec d’autres utilisateurs. Elle voit toutes les IPs des autres personnes qui partagent. Donc dans le cas d’un VPN elle voit l’IP du VPN et dans le cas de la Seedbox elle voit celui de la Seedbox et comme dans les deux cas les IPs sont à l’étranger elle ne peut verbaliser. Un peu comme si vous vous faisiez flasher par un radar avec une plaque étrangère...

- le blocage des IP France
Certains logiciels de torrent permettent de mettre une liste d'IP que vous bloquez. Vous pouvez ainsi bloquer toutes les IP françaises, cela vous empêchera d'échanger avec les utilisateurs torrent français, mais cela bloquera aussi la HADOPI qui est située en France (c'est une méthode gratuite et plutôt simple, mais elle est considérée comme moyennement fiable).

- la seedbox
C'est la solution royale (mais potentiellement la plus coûteuse) : il s'agit d'un ordinateur distant^[Un serveur, c'est un ordinateur, mais qui est dans un datacenter, c'est-à-dire que vous ne le commanderez qu'à distance, le plus souvent en ligne de commande.] qui récupérera le contenu torrent à votre place. Ainsi vous pourrez récupérer votre fichier par téléchargement direct sur votre ordi distant, donc sans être espionné par la HADOPI. Donc là c'est un chouia technique, mais très puissant. Et payant, le moins cher tournera autour de 3 euros par mois (pour 40 Go d'espace de stockage) avec tout configuré. Après si vous voulez plus d'espace, il sera rapidement moins cher d'installer vous-même sur un serveur ce qu'il faut. Ce n'est pas si compliqué et il y a des tutos pas à pas (mais bon ça ne se passe jamais exactement comme prévu !). (On en parle plus en annexe)

# Trouver le nom correct du type de document recherché

_Recherche du nom correct_
Il faut être sûr du nom du film, de la série, du livre ou du logiciel que l'on recherche. Cela vaut le coup d'aller sur « imdb.com » pour voir les différents titres existants, pour un film par exemple :

| Also Known As (AKA)        |  ?                                                   |
| -------------------------- | ---------------------------------------------------- |
| (original title)           | Sai yau gei: Yut gwong bou haap                      |
| France                     | Le roi singe 1 - La boîte de Pandore                 |
| Germany                    | Eine chinesische Odyssee                             |
| Hong Kong (English title)  | A Chinese Odyssey Part One: Pandora's Box            |
| Hong Kong (Mandarin title) | Xi you ji di yi bai ling yi hui zhi yue guang bao he |
| UK                         | A Chinese Odyssey: Part One - Pandora's Box          |
| Vietnam                    | Dai Thoai Tay Du Phan 1: Nguyet Quang Bao Hop        |
| World-wide (English title) | A Chinese Odyssey Part One: Pandora's Box            |

Ainsi vous pouvez adapter le titre au moteur de recherche de torrent que vous utilisez (s'il est français, choisissez le titre français, s'il est américain, le titre américain).

_Pour les certains films, recherche par nom de réalisateur_
Parfois il vaut mieux mettre juste le nom du réalisateur et voir ce que le site trouve, soit parce que le titre est trop long, trop court, ou prête à confusion, soit parce qu'il y a des packs de film du même auteur (un film qui s'appelle par exemple "end" va faire ressortir plein de résultats...). Il faut aussi parfois ajouter l'année de distribution, quand les films ou séries sont des remakes, l'année est la seule chose qui permet de distinguer entre deux titres.

Dans certains cas, le film recherché est un court métrage sorti compilé avec d'autres courts métrages sous un autre nom. Dans ce cas, la recherche par nom de réalisateur peut vous faire trouver un fichier comportant toute sa filmographie : il sera lourd, mais vous pouvez choisir de n'en télécharger qu'une partie.
Bref vous voilà prévenus : il faut chercher avec toutes les nomenclatures possibles...

_Affiner votre recherche grâce aux fonctions des caractères spéciaux_
Certains caractères ont des fonctions particulières, les guillemets par exemple :
E.g. : si je cherche : Bad Boys for Life 2020
Si je mets : Bad Boys for Life "2020" 🡪 cela masquera tous les résultats qui ne contiennent pas "2020".
Ecrire : "Bad.Boys.for.Life.2020.1080p.WEBRip.x265-RARBG" 🡪 vous permettra de chercher la phrase complète et non seulement un des mots contenus dans la phrase.

_Si la recherche ne donne rien, essayer sans accents, espaces…._
Les titres des fichiers mis en ligne correspondent souvent à la norme HTML^[Enfin, en théorie. Par ce que c'est plutôt une ancienne convention encore utilisée.], ils seront donc souvent écrits :
- sans accents,
- avec des "." ou des "_" a la place des espaces
- parfois écrits en minuscules.


![[Brochure/imagetelechargement/illustre4.png]]
_Comprendre les titres que vous lisez_
D'ailleurs, au passage, petit point de nomenclature. Ce nom de fichier vous indique le titre, l'année de sortie, la résolution , la source "webrip" (ici, WEBRip indique que le fichier provient d'un site de streaming légal à priori), ensuite est indiqué l'encodage de la vidéo "x265" puis l'équipe qui a mis en ligne ce fichier^[Englisisme oblige on apelle ça des « teams » c'est souvent un moyen de savoir si le fichier est de qualité quand vous connaissait le nom de la team et leur travail…] : RARBG dans notre cas. (annexe sur la résolution la source et l'encodage)

_Dans le cas des films, type de fichier:_
Les formats les plus courant aujourd'hui de fichier vidéo sont ee MKV et le MP4 et le AVI.

*Et les format DVD « brut » donc non encodé dans un fichiers :*
Souvent, le fichier sera gros (souvent 4.7 Go, taille d'un DVD standard) et il pourra se présenter sous plusieurs formes :
1. Soit un dossier composé d'un dossier "VIDEO_TS" avec à l'intérieur des fichiers ".vob" et d'autres trucs (les .vob étant les fichiers vidéo au format mpeg2).
2. Sinon cela pourra être une image ISO, c'est à dire une copie d'un DVD. Elle se présente sous la forme d'un fichier en ".iso" qui comprendra la même arborescence qu'un dossier de type « VIDEO_TS ».
## Pour les films : VO/VF, résolution, etc

_Chercher un film en VOST fr sur un moteur de recherche de torrent français_

Les films et séries peuvent être téléchargés dans de multiples langues et formats. Dans ce texte, je pars du principe que l'on cherche de la VO sous-titrée français. Dans le cas d'un film français, la question ne se pose normalement pas trop. Parfois les films québécois ont besoin de sous-titres, mais c'est une exception. Donc dans un premier temps, le plus simple est d'aller sur un moteur de recherche de torrent français : avec un peu de chance vous allez trouver votre contenu en VO avec des sous-titres français.

_Chercher un film en VOST fr sur un moteur de recherche de torrent anglophone, et ses sous-titres sur un site spécialisé_

Si vous ne trouvez pas votre fichier sur un moteur de torrent français, s'il n'est plus partagé, ou si votre téléchargement est limité sur le site de torrent français^[Les trackers privés sont la plupart du temps utilisés conjointement avec un site qui demande la création d'un compte. Le principe est de mesurer la quantité d'échange des torrents du tracker que vous faites afin d'établir votre ratio. Si votre ratio est trop bas, le tracker vous empêchera de télécharger plus (voir en annexe truquer son ratio...)] et que vous préférez autant que possible utiliser d'autres sites illimités^[Les trackers publics n'imposent aucune restriction de ratio ou de tout autre ordre.], utilisez un moteur de recherche anglais.

Le fichier ne comportera probablement pas de sous-titre français de base (hormis le contenu Netflix qui s'accompagne très souvent des sous-titres d'une vingtaine de langues, dont le français). Mais il existe une solution qui consiste à aller chercher les sous-titres sur d'autres sites spécialisés. Gardons l'exemple pris précédemment : nous allons chercher les sous-titres pour le fichier nommé « Bad.Boys.for.Life.2020.1080p.WEBRip.x265-RARBG ».

Si vous cherchez les sous-titres, l'idéal est qu'ils soient proposés exactement pour ce nom de fichier. S'il n'y a que le nom d'équipe en commun (ici RARBG), c'est bien. À défaut vous pouvez aussi regarder si c'est le même type de source (ici WebRip) en espérant que le timing de la source soit le même que celui des sous-titres.

Parfois vous pouvez aussi inverser l'ordre de recherche (rechercher les sous-titres en premier). Par exemple, si vous trouvez un fichier de sous-titre se nommant : "Bad.Boys.for.Life.2020.WEB-DL.x264-FGT.srt", vous pouvez en déduire aisément qu'un fichier téléchargeable doit exister s'appelant "Bad.Boys.for.Life.2020.WEB-DL.x264-FGT". Vous pouvez ainsi mettre directement cette recherche dans un moteur de recherche non spécialisé et espérer trouver le site qui propose le torrent du même nom.

Si malgré tout cela vous avez des sous-titres qui ne sont pas synchronisés avec les dialogues, vous pouvez encore les resynchroniser (en annexe).

Si vous ne trouvez pas de sous-titre dans la langue que vous souhaitez, mais qu'il y en a en anglais par exemple, vous pouvez tenter de traduire les sous-titres avec DeepL (en annexe).

Si vous n'avez aucun sous-titre, vous êtes dans une situation délicate. Vous pouvez essayer de les faire vous-même. Je ne suis pas spécialiste, mais "Aegisub" est un bon logiciel pour commencer (en annexe).

À savoir qu'il existe un bon nombre de films qui sont encapsulés dans un fichier MKV. Cela permet d'inclure plusieurs pistes audio et de sous-titres. Ainsi, quand vous lancez le film, vous pouvez bien l'entendre en russe et avoir des sous-titres anglais. Il vous suffit de sélectionner les bonnes pistes (par exemple dans VLC) pour avoir le contenu en anglais sous-titré français.

Les sites de sous-titres :

<http://davidbillemont3.free.fr/>

Un ancien site qui n'a pas toujours des sous-titres très récents, mais beaucoup de vieux sous-titres rares.

<https://www.subsynchro.com/>

Les sous-titres les plus récents pour les films actuels et vous pouvez trouver la version qui correspond à votre fichier.

<https://www.addic7ed.com/>

Les sous-titres de toutes les séries les plus récentes.

<https://www.opensubtitles.org/fr>

Un site généraliste qui a beaucoup de ressources, mais pas toujours en français...

[https://www.betaseries.com/](https://www.betaseries.com/series/agenda)

Un autre site de sous-titres de séries qui permet souvent de télécharger un pack de sous-titres pour une saison entière...
## Le juste nom du logiciel

Pour les logiciels, ne vous contentez pas de mettre le nom du logiciel. Parfois le nom ne donne d'ailleurs rien du tout, il vaut mieux mettre la compagnie qui produit le logiciel. Pensez aussi à indiquer la version que vous cherchez pour filtrer un résultat trop général. Précisez également votre plateforme si le logiciel existe sur Mac et PC. Il peut exister plusieurs fichiers torrent avec la même version du logiciel mais pas la même méthode de crack... Là, il faut essayer celle qui marche le mieux pour vous et ne pas hésiter à lire les commentaires sur le site du tracker torrent qui apportent souvent des informations précieuses.
## Pour les logiciels : la langue et la version

Pour les logiciels, c'est plus simple. Il faut chercher tout d'abord la plateforme (Mac ou PC) puis espérer qu'il soit en français ou en version multilingue (ce qui est souvent le cas). Dans certains cas exceptionnels, on pourra ajouter un pack de langue française au logiciel après l'avoir installé.

Il ne faut pas oublier non plus que la plateforme ne suffit pas pour assurer la compatibilité avec le logiciel. Pour macOS, la version de votre système est importante. Il faut vérifier en cherchant sur Internet quelle est la version optimale pour votre système (et si elle est disponible quelque part...). Pour Windows aussi, mais le système est plus permissif que macOS. Il faut également vérifier si les logiciels sont compatibles entre eux quand ils travaillent de concert (un plug-in pour "Premiere" par exemple...).

# Les livres numériques

Aujourd'hui les liseuses ne sont pas forcément très chères. Évitez les liseuses Amazon (Kindle) qui sont verrouillées sur bon nombre de points. Le format le plus polyvalent est l'EPUB et on trouve beaucoup de livres dans ce format. Malheureusement, on trouvera aussi beaucoup de PDF qui ne permettent pas de changer la taille de la page, ce qui peut être gênant sur une petite liseuse...

## Les sites où trouver des livres

https://annas-archive.org/datasets
Le site ultime où il y a énormément de ressources... C'est un méta-moteur qui va chercher notamment sur Libgen et Z-library.

https://monoskop.org/Monoskop
Plus orienté sciences sociales.

https://bibliotheques.paris.fr/
Alors oui, la bonne blague : vous pouvez en télécharger "légalement" sur certaines bibliothèques. Après, il faudra passer par Calibre (explication plus bas dans les logiciels) pour faire sauter la sécurité et pouvoir "garder" le livre quand vous le rendrez à la bibliothèque.

## Les applications pour gérer les ebooks et en créer

Pour convertir et gérer votre bibliothèque, je ne peux que vous conseiller https://calibre-ebook.com/fr. Vous pouvez ajouter des extensions pour faire sauter les DRM^[La gestion des droits numériques ou la gestion numérique des restrictions, en anglais « digital rights management », ou encore les mesures techniques de protection, ont pour objectif de contrôler l'utilisation qui est faite des œuvres numériques par leur chiffrement.] des livres et les garder indéfiniment.

En Annexe vous trouverais un guide complet sur la numérisation d'un livre.

# Les sites torrents, leurs pubs et autres cochonneries...

Les sites torrents ne sont pas forcément vos amis, ils peuvent contenir un bon nombre de publicités plus ou moins agressives... Pour cela utilisez un bon bloqueur de pub type "ublock origin". De plus, il y a parfois des liens "download" qui ne sont que des redirections vers des sites publicitaires divers ou qui vous feront télécharger des fichiers en ".exe" qui sont des logiciels malveillants... Si jamais vous en téléchargez un, pas de panique : il suffit de ne pas le lancer... Et la plupart des antivirus reconnaissent sans problème ces programmes douteux.


Les sites de torrents :
<https://www.yggtorrent.top>
Le site français privé par excellence qui remplace le défunt t411 qui avait un vaste choix. YGG n'a plus autant de ressources, mais s'étoffe avec le temps. À noter que l'équipe est moins sympathique, il est plus difficile de garder son ratio... Le site change souvent de nom de domaine, vous pouvez vérifier la "bonne" URL ici : https://yggland.fr/FAQ-Tutos/#status (ou sur Wikipedia https://fr.wikipedia.org/wiki/Ygg)

[https://1337x.to/](https://1337x.to/home/)
_Tracker_ public anglais propre et efficace.

https://proxybay.onl/
Liste de serveurs miroirs de The Pirate Bay.

[https://karagarga.in/](https://karagarga.in/browse.php)
_Tracker_ privé spécialisé dans les films rares. Par contre, il faut une invitation et elle n'est pas facile à obtenir...

[https://rutracker.org/forum/index.php](https://rutracker.org/forum/index.php)
Mon tracker russe préféré avec beaucoup de contenu. Il faut soit apprendre le russe soit trouver où il faut cliquer... (soit le traduire avec firefox...)

http://uniondht.org/
Un autre _tracker_ russe.

https://unblockit.pages.dev/
C'est un site qui référence des miroirs de plusieurs sites de téléchargement torrents.

# Le Téléchargement en torrent

Donc c'est bon, vous êtes équipé, sécurisé, vous avez trouvé votre fichier torrent ou magnet ? On récapitule : vous avez trouvé le fichier torrent ou magnet, vous avez sécurisé votre connexion vis-à-vis d'HADOPI ou vous n'en aviez rien à faire, car vous téléchargez sur le WiFi du voisin du deuxième étage.
![[Brochure/imagetelechargement/illustre2.png]]
Une fois lancé le téléchargement dans votre logiciel, vous avez plusieurs informations intéressantes :
- le pourcentage de téléchargement (100% = terminé !)
- le nombre de seed (les personnes qui ont le fichier complet)
- le nombre de leecher (les personnes qui n'ont rien ou seulement des bouts du fichier)
- le nombre de peer (tous les gens qui ont ou n'ont pas le fichier)
- à combien vous recevez (exprimé en kbs, kilobits par seconde)
- à combien vous émettez (exprimé en kbs, kilobits par seconde)
- le ratio d'échange du fichier (si vous avez reçu autant que vous avez donné, voire plus...)

Dans tous les cas, au début, patientez avant de tirer des conclusions. Cela peut prendre une dizaine de minutes avant que tout ne se mette bien en place (à noter que cela peut aussi mettre des jours si personne n'est là pour émettre... Mais la patience peut porter ses fruits même des semaines après...).

# Et s'il n'existe rien en torrent : le "direct download"

Le torrent est bien la technologie la plus utilisée pour le téléchargement illégal mais ce n'est pas la seule !

Il existe d'autres réseaux de _peer to peer_ qui sont globalement désertés pour la vidéo, mais par exemple Soulseek (<http://www.slsknet.org>) est encore très utilisé pour la musique et vous pouvez y trouver des pépites !

Hors du traditionnel "peer to peer", il existe maintenant ce qu'on appelle le "direct download", autrement dit "téléchargement direct". Il s'agit de sites qui référencent des fichiers (vidéo ou logiciel) accessibles directement en téléchargement car stockés sur des gros serveurs d'entreprises qui se rémunèrent via la publicité et l'abonnement qu'elles vous proposent pour télécharger plus vite et/ou plus de contenu. Légalement, vous ne pouvez pas être inquiété pour ce type de téléchargement, mais la HADOPI fait la chasse à ces sites et les ferme régulièrement. Les entreprises qui stockent les fichiers les suppriment quand elles sont notifiées que le fichier est illégal, donc vous trouverez souvent des liens morts qui ne pointent plus vers rien.

par exemple pour les logiciels : https://haxnode.net/
et pour les applications android : https://9mod.com/

# Comment regarder

Bon, lire un fichier vidéo c'est simple, sauf quand cela devient compliqué...

D'abord les petits soucis de base :
La sélection des bonnes pistes audio-vidéo et de sous-titres dans le cas des fichiers vidéo encapsulés (genre MKV). Si vous lancez votre film et que la langue et les sous-titres ne sont pas les bons, ce n'est pas forcément que le fichier ne contient pas ces pistes : il suffit de les sélectionner dans VLC. Ce sera dans le menu (ou le menu clic droit) :

audio → pistes audio
Sous-titres → pistes de sous-titre

Dans certains cas, les sous-titres sont dans un fichier à part. S'il a le même nom que le fichier vidéo, il sera normalement chargé automatiquement, sinon :
Sous-titres → ajouter un fichier de sous-titre

Les DVDs :
Vous pouvez aisément lire les .iso ou les dossiers de DVD directement avec VLC sans opération particulière. Le problème du DVD est souvent sa taille, pour une qualité assez moyenne. Si vous voulez stocker ou envoyer le film et que cela soit plus léger, vous pouvez utiliser _Handbrake_ (<https://handbrake.fr/>), un logiciel d'encodage libre relativement simple qui pourra encoder votre DVD dans un format plus léger, tout en conservant une bonne qualité. De plus, il gère les sous-titres s'il y en a.

Les plus gros soucis : plateformes particulières et haute résolution...
Si vous avez un vieil ordinateur ou une vieille platine DVD/DivX, vous risquez d'avoir de multiples soucis si le fichier est trop volumineux (comme du 4K), si l'encodage est trop moderne (comme H.265) et si les sous-titres sont intégrés (comme en MKV). Pour éviter les problèmes avec le matériel ancien, privilégiez les vieux fichiers basiques qui ont fait leurs preuves...

# Comment installer un logiciel

C'est difficile de faire une explication générique, car cela dépend évidemment de la plateforme (Mac ou PC) et du logiciel lui-même.
L'idée générale reste toujours la même :

Il faut installer le logiciel et faire souvent une modification pour s'affranchir de la licence.

Pour un certain nombre de logiciels, on coupe Internet pendant l'installation et on empêche le logiciel d'y accéder pour qu'il ne puisse pas s'auto-vérifier (sous Windows, le pare-feu de Windows est tout à fait capable de faire cela ; sous macOS on utilise généralement "Little Snitch" ou "Radio Silence" qu'il faut aussi pirater...) on peut aussi modifier les redirections avec le fichier "hosts" les ip a bloquer sont généralement indiqué dans l'installation.

En général, on a donc une installation de logiciel normale et un dossier comprenant de quoi modifier à notre avantage une fois le logiciel installé. Cela pourra se nommer indifféremment :

Crack, Patch, Serial, Unlocker, Keygen, Key, Cerise...

Le mieux est de lire le fichier "lisez-moi" ou "readme" qui sont en .txt ou .nfo (le NFO se lit avec un éditeur de texte basique : Notepad, TextEdit...). Consultez aussi la page sur laquelle vous avez téléchargé le torrent : l'uploader a peut-être mis des informations supplémentaires pour l'installation, et parfois les commentaires révèlent des problèmes résolubles.

À noter que votre antivirus peut bloquer ou supprimer le fichier crack/keygen que vous avez téléchargé... Ne vous inquiétez pas, c'est très rarement un véritable virus, mais plutôt un crack qui a un comportement "anormal" pour le "policier" de votre ordinateur qu'est votre antivirus. Il faudra donc désactiver l'antivirus pendant l'installation ou lui dire que le fichier ne comporte aucun risque pour pouvoir œuvrer en paix.

Parfois vous n'aurez qu'un seul fichier pour installer votre logiciel, en ".iso". C'est, comme pour les DVD, une "image disque". Les versions récentes de Windows vous permettent de "monter" (c'est-à-dire faire apparaître comme s'il était inséré dans un lecteur) les fichiers ISO en faisant un simple clic droit puis "monter". Pour les anciennes versions, vous pouvez utiliser Virtual Clone Drive (<https://www.elby.ch/fr/products/vcd.html>) qui créera un lecteur de disque virtuel. Mac OS intègre lui aussi directement un outil pour monter les images disque notamment les « .dmg » qui sont beaucoup plus courantes.

# Les habitudes

Vous téléchargez maintenant tous les jours, vous êtes habitué à choisir le format qui va bien avec votre vidéoprojecteur/écran. Si c'est un bon film, un bon 1080p est bien agréable. Mais pour la série que vous regardez d'un œil, le 480p est largement suffisant (et beaucoup plus léger). Vous allez d'ailleurs toujours sur le même site de torrent pour télécharger le nouvel épisode de votre série. Et peut-être même que vous identifiez les "teams" d'encodeurs qui mettent toujours le bon fichier pour vous... Bref, vous avez des habitudes. Quand vous faites une opération répétitive sur un ordinateur, il y a souvent quelqu'un qui a codé quelque chose qui peut le faire à votre place... Ainsi, si vous cherchez, vous pouvez trouver des flux RSS (flux d'abonnements) qui vous permettront de télécharger automatiquement ce que vous souhaitez... Et il y a même ce site <https://showrss.info> qui vous permet de créer un flux RSS de toutes les séries que vous suivez dans la résolution que vous souhaitez. Il vous fournira un flux dans lequel apparaîtront les épisodes dès qu'ils sont disponibles...

# Comment classer

Quand vous téléchargez un grand nombre de films/séries et que vous souhaitez les garder ou les échanger, vous pouvez être tenté de faire ça bien ! Il existe pour ça plusieurs outils.

MKVmerge :
Logiciel libre (qui fait partie d’une suite de logiciels
— MKVtoolnix — pour gérer les .mkv) qui permet de faire des fichiers .mkv pouvant ainsi encapsuler dans un seul fichier une piste vidéo avec plusieurs pistes audio et sous-titres, permettant ainsi d’avoir un fichier par film plutôt qu’un dossier avec des sous-titres externes.
https://mkvtoolnix.download/downloads.html

FileBot :
Un logiciel payant à cracker… Il permet de renommer un groupe de fichiers d’une série pour avoir une belle nomenclature pour les 100 épisodes de votre série préférée...
https://www.filebot.net/

Une Alternative opensource a filebot :
https://github.com/StrawberryStego/Simpler-FileBot?tab=readme-ov-file


# Annexe

## Résolution, Source et Encodage

La résolution est le nombre de pixels qui constitue l'image ainsi que leur forme (les pixels ne sont pas forcément carrés). Elle s'exprime en : nombre de pixels horizontaux × nombre de pixels verticaux. On y adjoint souvent un « p » ou un « i » pour distinguer les images progressives des images entrelacées (voir Wikipédia pour plus de détails).

Les résolutions les plus communes sont : 720p (1280 × 720 pixels progressifs) et 1080p (1920 × 1080 pixels progressifs). Il en existe évidemment plein d'autres : 144p, 240p, 360p, 480p (souvent nommé SD), 2K, 4K...)

Les sources dans les réseaux de téléchargement sont la source du film avant qu'il ne soit encodé :

- Le DVDRIP correspond à l'encodage réalisé à partir des DVD commercialisés. La taille est souvent entre 700 Mo et 1,2 Go.
- Le HDRIP (ou BLURAYRIP) reprend les mêmes principes que le DVDRIP sauf que celui-ci provient d'une source de haute définition, souvent 720p voire 1080p.
- Le TVRIP est enregistré directement à partir d'une télévision. Sa qualité est variable.
- Le WEBRIP (ou WEB-DL) est un RIP qui provient généralement d'une source trouvée sur le Web comme un podcast ou une offre VOD. La qualité est extrêmement variable.
- Le CAM (ou TS) est un enregistrement réalisé dans une salle de cinéma. L'image et surtout le son sont rarement de bonne qualité. On a tendance à l'appeler également SCREENER même si en réalité ce dernier provient d'une prise de vue sur un écran de TV.
- Le DVDSRC (DVD-SCREENER) consiste à enregistrer un écran puis utiliser un DVD comme support pour le diffuser.

En résumé, c'est toujours un mot composé à base de la source et de "RIP"...

La plupart des vidéos sur Internet sont réencodées pour alléger les fichiers.

En encodage vidéo, le plus utilisé est le H.264 et son pendant libre x264. Sa nouvelle version, le H.265, est progressivement utilisée (ainsi que le x265) mais les vieux appareils et anciens logiciels ne peuvent pas les lire. On trouve aussi du XviD et encore d'autres formats. La liste est en fait infinie...

En audio, les plus utilés sont le MP3, AAC, AC3, DD+. Avec du son qui va du mono au 5.1.

## Truquer son ratio

Il ne faut pas se mentir, le ratio c'est compliqué, surtout quand vous aimez les films d'auteur que personne ne télécharge. Vous risquez donc de rapidement avoir un ratio négatif sur les sites de torrent privé. Il existe plusieurs solutions pour remédier à cela :

- Ratio Master est un petit logiciel qui trompe le tracker en faisant croire que vous uploadez alors que ce n'est pas le cas. Je ne vous fais pas de lien car il n'y a pas de site officiel, mais n'importe quel moteur de recherche vous le trouvera. L'idée est simple : prenez un torrent bien partagé sur votre _tracker_ privé et mettez-le dans Ratio Master. Il simulera un envoi et fera donc remonter votre ratio... Par contre, soyez raisonnable pour ne pas simuler des uploads démesurés au risque de vous faire bannir (et soyez patient, la mise à jour de votre ratio prend quelques heures).

- Télécharger un gros fichier ailleurs et le reprendre... C'est sans doute la technique la plus propre et la plus efficace, surtout si vous avez une seedbox. L'idée est de prendre un torrent populaire sur un _tracker_ public (par exemple un jeu qui vient de sortir et qui fait 60 Go), mais qui existe aussi sur le tracker privé. Téléchargez tout le fichier avec le _tracker_ public puis supprimez le torrent public (mais pas les fichiers) et relancez le partage avec le torrent du _tracker_ privé. Vous pouvez ainsi "partager" 200 ou 300 Go sans avoir à télécharger les 60 Go de départ...

## Resynchroniser des sous-titres avec Subtitle Workshop

Le logiciel : <http://subworkshop.sourceforge.net/download.php>

Subtitle Workshop n'est pas le logiciel idéal pour faire des sous-titres, mais il est très pratique pour la resynchronisation. L'idée est simple : vous avez des sous-titres, mais ils ne sont pas synchronisés. Il y a plusieurs raisons potentielles :

Les sous-titres sont prévus pour un fichier où le film ou la série commence plus tard ou plus tôt (dans le cas d'une série, cela peut être le récapitulatif des épisodes précédents qui est absent, par exemple, ou dans le cas d'un film, la présentation des studios qui a été coupée). C'est le cas le plus simple : il suffit d'ajouter ou d'enlever quelques secondes à tous les sous-titres. Dans le menu « Edit » → « Timing » → « Set delay ».

Les sous-titres sont prévus pour un film qui ne présente pas le même nombre d'images par seconde et qui dure donc un tout petit peu plus longtemps. Dans ce cas, vous pouvez essayer de trouver quel est le FPS^[FPS : Images par seconde] de la source et de le faire correspondre avec le FPS de votre source dans le panneau à gauche « Input FPS » → « FPS ». Parfois cela ne suffit pas et vous pouvez utiliser une fonction un peu magique que vous trouverez dans « Edit » → « Timing » → « Adjust » → « Adjust Subtitles ». Là, vous mettez le timecode de la première ligne de sous-titre qui arrive à l'écran (il est parfois plus simple d'enlever des sous-titres du générique pour se concentrer sur la première ligne parlée) puis la dernière ligne de sous-titre et vous laissez le logiciel « ajuster » comme il peut. Le résultat est souvent surprenant de qualité.

Les sous-titres peuvent cumuler les désynchronisations (FPS différent / début au mauvais moment), auquel cas c'est un peu plus délicat...

Enfin, le pire des cas : les sous-titres sont pour une autre version de votre film, par exemple un "Director's Cut". Là, je ne vais pas vous le cacher, c'est galère.

## Traduire des sous-titres avec DeepL

Le logiciel : <https://www.deepl.com/translator>

C'est une technique pas très subtile, mais quand vous voulez voir le dernier blockbuster chinois et que vous ne trouvez pas de sous-titres autres qu'en anglais, et que vous préférez avoir un français approximatif plutôt que l'anglais, ça fonctionne plutôt bien.

Le principe est simple : vous copiez-collez votre fichier de sous-titres (SRT a priori) dans un fichier Word (DOC/DOCX) - vous pouvez le faire avec LibreOffice également. Puis vous traduisez le fichier avec DeepL et vous le recollez dans un fichier SRT. DeepL a l'avantage de ne pas toucher aux timecodes et il faut admettre que l'intelligence artificielle fonctionne plutôt bien pour la traduction... Si le film traite de métaphysique, par contre, cela risque d'être moins précis.

## Créer ou Traduire des sous-titres avec un LLM

Les modèles de langage comme ChatGPT ou Claude sont d'excellents traducteurs automatiques. Vous pouvez même, avec https://thewh1teagle.github.io/vibe/, créer des sous-titres en utilisant un modèle local de reconnaissance vocale.

## Créer des sous-titres avec Aegisub

Le logiciel : <http://www.aegisub.org/>

Si vous voulez traduire un fichier de sous-titres ou créer des sous-titres à partir de zéro, c'est le logiciel le plus simple et efficace. Je ne rentrerai pas dans un tutoriel détaillé, il y en a de nombreux disponibles sur Internet.

## Les téléchargeurs de sites de streaming

Vous pouvez télécharger un certain nombre de films et musiques sur des sites comme YouTube, Vimeo, Arte+7...

Pour cela, il existe un logiciel très puissant, mais pas toujours intuitif :  
<https://github.com/ytdl-org/youtube-dl>  

Une interface graphique existe ici : <https://github.com/MrS0m30n3/youtube-dl-gui>

Plus simple, il existe en version payante (trouvable en téléchargement...) : 4K Video Downloader.

Quand vous n'êtes pas sur votre ordinateur, il existe un certain nombre de sites qui permettent de faire la même chose sans rien installer, par exemple :

<https://www.savido.net/>  
<https://www.locoloader.com/>  
<https://notube.lol/fr/youtube-app-178>

Je dis "par exemple" car ces sites changent souvent. N'hésitez pas à chercher "YouTube downloader" (ou le nom de votre site préféré suivi de "downloader").

Dans certains cas, aucun téléchargeur ne fonctionnera. Vous pouvez alors enregistrer votre écran avec, par exemple, TechSmith Camtasia (payant, trouvable en téléchargement...) pour certains sites comme tenk.fr.

## Une seedbox : guide rapide

Pour louer une seedbox, vous pouvez trouver plusieurs offres, par exemple :

<https://www.cessfull.com/offers>

<https://www.sdedi.com/sdedibox/tarifs/>

C'est assez simple : pour environ 3 euros par mois, vous aurez une petite seedbox de 40-50 Go. Vous n'avez qu'à lui envoyer vos fichiers torrent et récupérer les fichiers téléchargés par une interface web ou par FTP (il existe des plug-ins pour Firefox ou Chrome pour envoyer directement les torrents ou liens magnet à votre seedbox).

Si vous avez envie de bidouiller et du temps libre, louer un serveur est tout à fait rentable puisque cela vous coûtera environ 80 € par an pour un serveur d'1 To. Vous en trouverez ici par exemple :  
<https://oneprovider.com/dedicated-servers/amsterdam-netherlands>

Là, il vous faudra installer une distribution Linux, puis en ligne de commande installer les logiciels nécessaires pour faire fonctionner une seedbox. Rassurez-vous, il existe des « scripts » qui se chargent de faire quasiment tout à votre place. Personnellement, j'utilise <https://swizzin.ltd/>

N'hésitez pas à lire et demander de l'aide sur le forum <https://mondedie.fr/t/Seedbox>.


## Numériser un livre

### La capture
Pour scanner un livre parfaitement avant on aller jusqu'a coupé la tranche pour avoir des feuilles parfaitement plate. Heuresement d'autres outils on vu le jour avec des poste de numérisation complexe et couteux qui "respecte" le livre. Il existe des tutoriel pour faire ce genre de station de numérisation en "V" [[illustration]] souvent avec deux webcams. Aujourd'hui ce qui me semble le plus simple pour un amateur éclairé et simplement d'acheter un pied pour smartphone et d'utiliser :
vFlat Scan - vous en trouverez une version crackée ici : https://9mod.com/vflat-scan-pdf-scanner-ocr.html

il faut un smartphone avec une bonne puissance car cela fait chauffé l'appareil surtout si vous utilisé la lumiére du téléphone ce qui conseiller. mais vous pouvez aussi ajouter une ring light le principe et d'avoir les pages bien éclairé sans ombre.
vFlat Scan fonctionne simplement et bien il va cadrer chaque page , effacer vos doigts qui tiennent le livre et corrigé la plupart des distortions. 

Une fois la numérisation faite vous obtenez un pdf volumineux mais qui est une bonne base pour la suite (le logiciel propose de la reconnaissance de caractére et de la compression mais la pour le coup vaut mieux faire cela ailleurs).

Je vous conseille dés cette étape de faire correspondre le nombre de page du pdf avec la numerotation du livre qui a ajouter une page blanche ou cas plus rare a mettre certaine premiére page non crucial a la fin du livre cela vous permettra de vous y retrouvez plus rapidement mais aussi de detectecter plus simplement les pages dont la capture a été oublié. (si vous avez par exemple bien la page 100 pdf/livre mais que sur la page pdf 150 vous avez la page livre 151 il y a une page manquante dans ce lot il faut la trouver !!). Pour gerer le pdf sur votre ordinateur aucun outils n'est vraiment parfait je vous conseille ABBY https://haxnode.net/abbyy-finereader-crack/. Il est celui que j'utilise pour la reconnaissance de caractére j'en reparle plus bas.
### Traitement post-capture

Une fois votre fichier rapatrié sur un ordinateur :
le logiciel idéal pour traité un livre est :
https://github.com/ImageProcessing-ElectronicPublications/scantailor-experimental

c'est un logiciel tout a fait complet pour le traitement mais il ne gére pas le pdf vous pouvais utiliser ces petits outils qui l'accompagne [[tailorofscantailor]] 

Donc vous aller commencer par transformer votre pdf en dossier avec un Tiff par page.

Si vous avez récupéré un fichier d'un livre de qualité moyenne vous pouvez aussi l'amélioré en commencant a cette étape en transformant le pdf en tiff aussi et pas d'inquiétude si vos image tiff contiennent 2 pages, scantailor sait les coupé.

Vous pouvez maintenant lancer scantailor et créer un projet en chargeant le dossier tiff.
La vous pourrais sinder, redresser, recadrer, retraiter et exporter votre livre. La il faudra réutilisé un petit outils pour transformer vos tiff en pdf.

### La Reconnaissance 

Vous avez votre livre dans un pdf bien propre mais vous voulez pouvoir faire une recherche dans le texte, Scantailor ne gére que des images et vous n'avez donc qu'un pdf d'image il faut utilisé de la reconnnaissance de caractére. Le meilleurs logiciel sans contexte aujourd'hui est : https://haxnode.net/abbyy-finereader-crack/ car contrairement a tout les autres que j'ai utilisé il va reconnaitre la mise en page et ne vas pas mettre dans le corps du texte du livre les titres de haut de page ou la numérotation. Il vous permettra même d'exporter le pdf dans d'autre format (word,epub,ect...) et il réussi d'ailleurs a souvent reconnaitre les notes de bas de pages. Bref une bonne reconnaissance qui bien qu'elle n'est pas de llm qui corrigerais sans doute certaine coquille s'en sort trés bien.