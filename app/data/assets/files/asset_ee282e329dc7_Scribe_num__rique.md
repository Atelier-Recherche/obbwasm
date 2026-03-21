# Numériser un livre

Pour numériser de maniére optimal, outils et techniques

# La capture
Pour scanner un livre parfaitement avant on aller jusqu'a coupé la tranche pour avoir des feuilles parfaitement plate. Heuresement d'autres outils on vu le jour avec des poste de numérisation complexe et couteux qui "respecte" le livre. Il existe des tutoriel pour faire ce genre de station de numérisation en "V" [[illustration]] souvent avec deux webcams. Aujourd'hui ce qui me semble le plus simple pour un amateur éclairé et simplement d'acheter un pied pour smartphone et d'utiliser :
vFlat Scan - vous en trouverez une version crackée ici : https://9mod.com/vflat-scan-pdf-scanner-ocr.html

il faut un smartphone avec une bonne puissance car cela fait chauffé l'appareil surtout si vous utilisé la lumiére du téléphone ce qui conseiller. mais vous pouvez aussi ajouter une ring light le principe et d'avoir les pages bien éclairé sans ombre.
vFlat Scan fonctionne simplement et bien il va cadrer chaque page , effacer vos doigts qui tiennent le livre et corrigé la plupart des distortions. 

Une fois la numérisation faite vous obtenez un pdf volumineux mais qui est une bonne base pour la suite (le logiciel propose de la reconnaissance de caractére et de la compression mais la pour le coup vaut mieux faire cela ailleurs).

Je vous conseille dés cette étape de faire correspondre le nombre de page du pdf avec la numerotation du livre qui a ajouter une page blanche ou cas plus rare a mettre certaine premiére page non crucial a la fin du livre cela vous permettra de vous y retrouvez plus rapidement mais aussi de detectecter plus simplement les pages dont la capture a été oublié. (si vous avez par exemple bien la page 100 pdf/livre mais que sur la page pdf 150 vous avez la page livre 151 il y a une page manquante dans ce lot il faut la trouver !!). Pour gerer le pdf sur votre ordinateur aucun outils n'est vraiment parfait je vous conseille ABBY https://haxnode.net/abbyy-finereader-crack/. Il est celui que j'utilise pour la reconnaissance de caractére j'en reparle plus bas.
# Traitement post-capture

Une fois votre fichier rapatrié sur un ordinateur :
le logiciel idéal pour traité un livre est :
https://github.com/ImageProcessing-ElectronicPublications/scantailor-experimental

c'est un logiciel tout a fait complet pour le traitement mais il ne gére pas le pdf vous pouvais utiliser ces petits outils qui l'accompagne [[tailorofscantailor]] 

Donc vous aller commencer par transformer votre pdf en dossier avec un Tiff par page.

Si vous avez récupéré un fichier d'un livre de qualité moyenne vous pouvez aussi l'amélioré en commencant a cette étape en transformant le pdf en tiff aussi et pas d'inquiétude si vos image tiff contiennent 2 pages, scantailor sait les coupé.

Vous pouvez maintenant lancer scantailor et créer un projet en chargeant le dossier tiff.
La vous pourrais sinder, redresser, recadrer, retraiter et exporter votre livre. La il faudra réutilisé un petit outils pour transformer vos tiff en pdf.

# La Reconnaissance 

Vous avez votre livre dans un pdf bien propre mais vous voulez pouvoir faire une recherche dans le texte, Scantailor ne gére que des images et vous n'avez donc qu'un pdf d'image il faut utilisé de la reconnnaissance de caractére. Le meilleurs logiciel sans contexte aujourd'hui est : https://haxnode.net/abbyy-finereader-crack/ car contrairement a tout les autres que j'ai utilisé il va reconnaitre la mise en page et ne vas pas mettre dans le corps du texte du livre les titres de haut de page ou la numérotation. Il vous permettra même d'exporter le pdf dans d'autre format (word,epub,ect...) et il réussi d'ailleurs a souvent reconnaitre les notes de bas de pages. Bref une bonne reconnaissance qui bien qu'elle n'est pas de llm qui corrigerais sans doute certaine coquille s'en sort trés bien.


# La gestion

Pour convertir et gérer votre bibliothèque, je ne peux que vous conseiller https://calibre-ebook.com/fr. Vous pouvez ajouter des extensions pour faire sauter les DRM^[La gestion des droits numériques ou la gestion numérique des restrictions, en anglais « digital rights management », ou encore les mesures techniques de protection, ont pour objectif de contrôler l'utilisation qui est faite des œuvres numériques par leur chiffrement.] des livres et les garder indéfiniment.


